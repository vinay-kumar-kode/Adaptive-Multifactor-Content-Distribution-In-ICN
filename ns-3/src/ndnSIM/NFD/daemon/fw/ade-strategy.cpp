/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/**
 * Copyright (c) 2014-2021,  Regents of the University of California,
 *                           Arizona Board of Regents,
 *                           Colorado State University,
 *                           University Pierre & Marie Curie, Sorbonne University,
 *                           Washington University in St. Louis,
 *                           Beijing Institute of Technology,
 *                           The University of Memphis.
 *
 * This file is part of NFD (Named Data Networking Forwarding Daemon).
 *
 * Adaptive Multi-Factor Forwarding Strategy (ADE)
 */

#include "ade-strategy.hpp"
#include "algorithm.hpp"
#include "common/logger.hpp"
#include <limits>
#include <cmath>

namespace nfd {
namespace fw {

NFD_LOG_INIT(AdeStrategy);
NFD_REGISTER_STRATEGY(AdeStrategy);

const time::milliseconds AdeStrategy::RETX_SUPPRESSION_INITIAL(10);
const time::milliseconds AdeStrategy::RETX_SUPPRESSION_MAX(250);

AdeStrategy::AdeStrategy(Forwarder& forwarder, const Name& name)
  : Strategy(forwarder)
  , ProcessNackTraits(this)
  , m_retxSuppression(RETX_SUPPRESSION_INITIAL,
                      RetxSuppressionExponential::DEFAULT_MULTIPLIER,
                      RETX_SUPPRESSION_MAX)
  , m_lastSelectedFaceId(0)
  , m_lastSwitchTime(time::steady_clock::now())
{
  ParsedInstanceName parsed = parseInstanceName(name);
  if (!parsed.parameters.empty()) {
    NDN_THROW(std::invalid_argument("AdeStrategy does not accept parameters"));
  }
  if (parsed.version && *parsed.version != getStrategyName()[-1].toVersion()) {
    NDN_THROW(std::invalid_argument(
      "AdeStrategy does not support version " + to_string(*parsed.version)));
  }
  this->setInstanceName(makeInstanceName(name, getStrategyName()));
}

const Name&
AdeStrategy::getStrategyName()
{
  static const auto strategyName = Name("/localhost/nfd/strategy/ade").appendVersion(1);
  return strategyName;
}

double
AdeStrategy::calculateFaceScore(FaceId faceId, const FaceTelemetry& t) const
{
  // Normalization weights:
  // Delay weight: 0.30
  // Loss weight: 0.25
  // Link Cost weight: 0.15
  // Cache Hit weight: 0.20 (benefit metric: higher is better -> inverted as 100 - hit%)
  // Queue depth weight: 0.10
  const double w_delay = 0.30;
  const double w_loss  = 0.25;
  const double w_cost  = 0.15;
  const double w_cache = 0.20;
  const double w_queue = 0.10;

  double delayComponent = t.rtt.count(); // in ms
  double lossComponent  = t.packetLossRatio * 100.0;
  double costComponent  = static_cast<double>(t.linkCost);
  double cacheComponent = (1.0 - t.cacheHitRatio) * 100.0;
  double queueComponent = t.queueCongestionRatio * 100.0;

  double compositeScore = (w_delay * delayComponent)
                        + (w_loss * lossComponent)
                        + (w_cost * costComponent)
                        + (w_cache * cacheComponent)
                        + (w_queue * queueComponent);

  return compositeScore;
}

void
AdeStrategy::updateRtt(FaceId faceId, time::milliseconds measuredRtt)
{
  FaceTelemetry& t = m_telemetry[faceId];
  if (t.interestsSent == 0) {
    t.rtt = measuredRtt;
  } else {
    // Exponential Weighted Moving Average (EWMA) with alpha = 0.25
    double alpha = 0.25;
    double smoothed = alpha * measuredRtt.count() + (1.0 - alpha) * t.rtt.count();
    t.rtt = time::milliseconds(static_cast<long>(smoothed));
  }
  t.dataReceived++;
  t.packetLossRatio = std::max(0.0, 1.0 - (static_cast<double>(t.dataReceived) / std::max(1u, t.interestsSent)));
  t.lastUpdated = time::steady_clock::now();
}

void
AdeStrategy::afterReceiveInterest(const Interest& interest, const FaceEndpoint& ingress,
                                  const shared_ptr<pit::Entry>& pitEntry)
{
  RetxSuppressionResult suppression = m_retxSuppression.decidePerPitEntry(*pitEntry);
  if (suppression == RetxSuppressionResult::SUPPRESS) {
    NFD_LOG_DEBUG(interest << " from=" << ingress << " suppressed");
    return;
  }

  const fib::Entry& fibEntry = this->lookupFib(*pitEntry);
  const fib::NextHopList& nexthops = fibEntry.getNextHops();

  if (nexthops.empty()) {
    NFD_LOG_DEBUG(interest << " from=" << ingress << " noNextHop");
    lp::NackHeader nackHeader;
    nackHeader.setReason(lp::NackReason::NO_ROUTE);
    this->sendNack(nackHeader, ingress.face, pitEntry);
    this->rejectPendingInterest(pitEntry);
    return;
  }

  Face* selectedFace = nullptr;
  double lowestScore = std::numeric_limits<double>::max();

  // Evaluate candidate next hops using ADE multi-factor scoring
  for (const auto& nh : nexthops) {
    Face& face = nh.getFace();
    if (!isNextHopEligible(ingress.face, interest, nh, pitEntry)) {
      continue;
    }

    FaceId faceId = face.getId();
    FaceTelemetry& t = m_telemetry[faceId];
    t.linkCost = nh.getCost();

    double score = calculateFaceScore(faceId, t);

    // Anti-flapping hysteresis: To prevent ping-pong oscillation,
    // switching away from the active face requires at least a 15% better score
    if (m_lastSelectedFaceId != 0 && faceId != m_lastSelectedFaceId) {
      score *= 1.15;
    }

    if (score < lowestScore) {
      lowestScore = score;
      selectedFace = &face;
    }
  }

  if (selectedFace != nullptr) {
    FaceId chosenFaceId = selectedFace->getId();
    if (chosenFaceId != m_lastSelectedFaceId) {
      NFD_LOG_INFO("ADE Path Switch: " << m_lastSelectedFaceId << " -> " << chosenFaceId
                                       << " (Score: " << lowestScore << ")");
      m_lastSelectedFaceId = chosenFaceId;
      m_lastSwitchTime = time::steady_clock::now();
    }

    m_telemetry[chosenFaceId].interestsSent++;
    this->sendInterest(interest, *selectedFace, pitEntry);
    return;
  }

  // Fallback if no next hop was eligible
  NFD_LOG_DEBUG(interest << " from=" << ingress << " noEligibleNextHop");
  this->rejectPendingInterest(pitEntry);
}

void
AdeStrategy::beforeSatisfyInterest(const Data& data, const FaceEndpoint& ingress,
                                   const shared_ptr<pit::Entry>& pitEntry)
{
  FaceId inFaceId = ingress.face.getId();
  // Extract PIT out-record timestamp to calculate instantaneous RTT
  auto outRecord = pitEntry->getOutRecord(ingress.face);
  if (outRecord != pitEntry->out_end()) {
    auto rtt = time::duration_cast<time::milliseconds>(time::steady_clock::now() - outRecord->getLastRenewed());
    updateRtt(inFaceId, rtt);
  }
}

void
AdeStrategy::afterReceiveNack(const lp::Nack& nack, const FaceEndpoint& ingress,
                              const shared_ptr<pit::Entry>& pitEntry)
{
  FaceId faceId = ingress.face.getId();
  // Penalize face on NACK reception
  m_telemetry[faceId].packetLossRatio = std::min(1.0, m_telemetry[faceId].packetLossRatio + 0.15);
  this->processNack(nack, ingress.face, pitEntry);
}

void
AdeStrategy::onDroppedInterest(const Interest& interest, Face& egress)
{
  FaceId faceId = egress.getId();
  m_telemetry[faceId].packetLossRatio = std::min(1.0, m_telemetry[faceId].packetLossRatio + 0.10);
  NFD_LOG_DEBUG("Interest dropped on Face " << faceId);
}

} // namespace fw
} // namespace nfd
