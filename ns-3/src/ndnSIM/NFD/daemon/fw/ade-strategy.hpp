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

#ifndef NFD_DAEMON_FW_ADE_STRATEGY_HPP
#define NFD_DAEMON_FW_ADE_STRATEGY_HPP

#include "strategy.hpp"
#include "process-nack-traits.hpp"
#include "retx-suppression-exponential.hpp"
#include <map>
#include <chrono>

namespace nfd {
namespace fw {

/**
 * \brief Real-time telemetry tracked per upstream Face
 */
struct FaceTelemetry
{
  time::milliseconds rtt{20};             // Smoothed round-trip time (EWMA)
  double packetLossRatio{0.0};            // Estimated packet loss ratio [0, 1]
  uint32_t linkCost{10};                  // Static FIB cost metric
  double cacheHitRatio{0.0};              // Observed ContentStore hit ratio [0, 1]
  double queueCongestionRatio{0.0};       // Queue buffer utilization [0, 1]
  uint32_t interestsSent{0};
  uint32_t dataReceived{0};
  time::steady_clock::TimePoint lastUpdated;
};

/**
 * \brief Adaptive Multi-Factor Content Distribution Strategy (ADE)
 *
 * Dynamically evaluates candidate upstream faces based on latency, loss,
 * link cost, cache availability, and queue congestion, selecting the lowest
 * composite cost face with anti-flapping hysteresis.
 */
class AdeStrategy : public Strategy
                  , public ProcessNackTraits<AdeStrategy>
{
public:
  explicit
  AdeStrategy(Forwarder& forwarder, const Name& name = getStrategyName());

  static const Name&
  getStrategyName();

public: // NFD Strategy Triggers
  void
  afterReceiveInterest(const Interest& interest, const FaceEndpoint& ingress,
                       const shared_ptr<pit::Entry>& pitEntry) override;

  void
  beforeSatisfyInterest(const Data& data, const FaceEndpoint& ingress,
                        const shared_ptr<pit::Entry>& pitEntry) override;

  void
  afterReceiveNack(const lp::Nack& nack, const FaceEndpoint& ingress,
                   const shared_ptr<pit::Entry>& pitEntry) override;

  void
  onDroppedInterest(const Interest& interest, Face& egress) override;

private:
  /**
   * \brief Compute composite multi-factor score for an upstream face.
   * Lower score indicates better candidate path.
   */
  double
  calculateFaceScore(FaceId faceId, const FaceTelemetry& telemetry) const;

  /**
   * \brief Update telemetry measurements using Exponential Weighted Moving Average (EWMA)
   */
  void
  updateRtt(FaceId faceId, time::milliseconds measuredRtt);

NFD_PUBLIC_WITH_TESTS_ELSE_PRIVATE:
  static const time::milliseconds RETX_SUPPRESSION_INITIAL;
  static const time::milliseconds RETX_SUPPRESSION_MAX;
  RetxSuppressionExponential m_retxSuppression;

  // Telemetry map indexed by FaceId
  std::map<FaceId, FaceTelemetry> m_telemetry;

  // Anti-flapping hysteresis tracking
  FaceId m_lastSelectedFaceId{0};
  time::steady_clock::TimePoint m_lastSwitchTime;

  friend ProcessNackTraits<AdeStrategy>;
};

} // namespace fw
} // namespace nfd

#endif // NFD_DAEMON_FW_ADE_STRATEGY_HPP
