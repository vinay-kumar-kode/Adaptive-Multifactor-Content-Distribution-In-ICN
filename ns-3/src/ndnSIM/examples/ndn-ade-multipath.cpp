/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/**
 * Adaptive Multi-Factor Content Distribution in Information-Centric Networks (ICN)
 * File: src/ndnSIM/examples/ndn-ade-multipath.cpp
 *
 * Reproducible Experiment Topology:
 *
 *               +------------+
 *               | Router R1  | (Path 1: 20Mbps, 15ms base - High Speed, Congestion target)
 *           /-->|            |---\
 *          /    +------------+    \
 *         /                        \
 *   +----------+ +------------+ +----------+
 *   | Consumer | | Router R2  | | Producer |
 *   |   (C0)   |-| Router R0  |-|   (P0)   |
 *   +----------+ | (ADE Node) | +----------+
 *         \      +------------+    /
 *          \    +------------+    /
 *           \-->| Router R3  |---/
 *               | (CS Cache) | (Path 3: 8Mbps, 40ms, High Cache Hit)
 *               +------------+
 */

#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/point-to-point-module.h"
#include "ns3/ndnSIM-module.h"

namespace ns3 {

int
main(int argc, char* argv[])
{
  std::string strategyType = "ade"; // Options: "ade", "best-route", "multicast"

  CommandLine cmd;
  cmd.AddValue("strategy", "Forwarding strategy to test: ade, best-route, multicast", strategyType);
  cmd.Parse(argc, argv);

  std::cout << "\n======================================================\n";
  std::cout << "  Adaptive Multi-Factor Content Distribution in ICN\n";
  std::cout << "  Forwarding Strategy Under Test: " << strategyType << "\n";
  std::cout << "======================================================\n\n";

  // 1. Create Nodes
  // Node 0: Consumer (C0)
  // Node 1: Edge Router (R0 - ADE Decision Engine)
  // Node 2: Intermediate Router R1 (Path 1)
  // Node 3: Intermediate Router R2 (Path 2)
  // Node 4: Intermediate Router R3 (Path 3 - Cache Enabled)
  // Node 5: Content Producer (P0)
  NodeContainer nodes;
  nodes.Create(6);

  // 2. Configure Point-to-Point Links
  PointToPointHelper p2pAccess;
  p2pAccess.SetDeviceAttribute("DataRate", StringValue("100Mbps"));
  p2pAccess.SetChannelAttribute("Delay", StringValue("2ms"));
  p2pAccess.SetQueue("ns3::DropTailQueue<Packet>", "MaxSize", StringValue("100p"));

  // Consumer C0 to ADE Router R0
  p2pAccess.Install(nodes.Get(0), nodes.Get(1));

  // Path 1 Links: R0 -> R1 -> P0 (High speed initial path)
  PointToPointHelper p2pPath1;
  p2pPath1.SetDeviceAttribute("DataRate", StringValue("20Mbps"));
  p2pPath1.SetChannelAttribute("Delay", StringValue("15ms"));
  p2pPath1.SetQueue("ns3::DropTailQueue<Packet>", "MaxSize", StringValue("25p"));
  auto devR0_R1 = p2pPath1.Install(nodes.Get(1), nodes.Get(2));
  p2pPath1.Install(nodes.Get(2), nodes.Get(5));

  // Path 2 Links: R0 -> R2 -> P0 (Reliable backup path)
  PointToPointHelper p2pPath2;
  p2pPath2.SetDeviceAttribute("DataRate", StringValue("10Mbps"));
  p2pPath2.SetChannelAttribute("Delay", StringValue("35ms"));
  p2pPath2.SetQueue("ns3::DropTailQueue<Packet>", "MaxSize", StringValue("50p"));
  p2pPath2.Install(nodes.Get(1), nodes.Get(3));
  p2pPath2.Install(nodes.Get(3), nodes.Get(5));

  // Path 3 Links: R0 -> R3 -> P0 (Cache-augmented path)
  PointToPointHelper p2pPath3;
  p2pPath3.SetDeviceAttribute("DataRate", StringValue("8Mbps"));
  p2pPath3.SetChannelAttribute("Delay", StringValue("45ms"));
  p2pPath3.SetQueue("ns3::DropTailQueue<Packet>", "MaxSize", StringValue("50p"));
  p2pPath3.Install(nodes.Get(1), nodes.Get(4));
  p2pPath3.Install(nodes.Get(4), nodes.Get(5));

  // 3. Install NDN Stack
  ndn::StackHelper ndnHelper;
  ndnHelper.SetDefaultRoutes(false); // We configure multi-path FIB explicitly

  // Configure in-network ContentStore on Router R3
  ndnHelper.SetOldContentStore("ns3::ndn::cs::Lru", "MaxSize", "500");
  ndnHelper.InstallAll();

  // 4. Multi-path FIB Route Configuration at Router R0
  // All three paths offer a route to /prefix with initial costs
  ndn::FibHelper::AddRoute(nodes.Get(1), "/prefix", nodes.Get(2), 10); // Path 1: Cost 10
  ndn::FibHelper::AddRoute(nodes.Get(1), "/prefix", nodes.Get(3), 20); // Path 2: Cost 20
  ndn::FibHelper::AddRoute(nodes.Get(1), "/prefix", nodes.Get(4), 30); // Path 3: Cost 30

  // Upstream routes to Producer
  ndn::FibHelper::AddRoute(nodes.Get(2), "/prefix", nodes.Get(5), 10);
  ndn::FibHelper::AddRoute(nodes.Get(3), "/prefix", nodes.Get(5), 10);
  ndn::FibHelper::AddRoute(nodes.Get(4), "/prefix", nodes.Get(5), 10);

  // 5. Strategy Selection
  std::string strategyUri = "/localhost/nfd/strategy/best-route";
  if (strategyType == "ade") {
    strategyUri = "/localhost/nfd/strategy/ade";
  } else if (strategyType == "multicast") {
    strategyUri = "/localhost/nfd/strategy/multicast";
  }

  ndn::StrategyChoiceHelper::Install(nodes.Get(1), "/prefix", strategyUri);
  ndn::StrategyChoiceHelper::Install(nodes.Get(2), "/prefix", "/localhost/nfd/strategy/best-route");
  ndn::StrategyChoiceHelper::Install(nodes.Get(3), "/prefix", "/localhost/nfd/strategy/best-route");
  ndn::StrategyChoiceHelper::Install(nodes.Get(4), "/prefix", "/localhost/nfd/strategy/best-route");

  // 6. Consumer Application (15 Interests per second)
  ndn::AppHelper consumerHelper("ns3::ndn::ConsumerCbr");
  consumerHelper.SetPrefix("/prefix");
  consumerHelper.SetAttribute("Frequency", StringValue("15"));
  consumerHelper.SetAttribute("Randomize", StringValue("exponential"));
  auto consumerApps = consumerHelper.Install(nodes.Get(0));
  consumerApps.Start(Seconds(1.0));
  consumerApps.Stop(Seconds(20.0));

  // 7. Producer Application (Returns 1024-byte payload)
  ndn::AppHelper producerHelper("ns3::ndn::Producer");
  producerHelper.SetPrefix("/prefix");
  producerHelper.SetAttribute("PayloadSize", StringValue("1024"));
  auto producerApps = producerHelper.Install(nodes.Get(5));
  producerApps.Start(Seconds(0.5));
  producerApps.Stop(Seconds(20.0));

  // 8. Phase 6 Dynamic Adaptation: Scheduled Congestion Spike at t = 7.0 seconds on Path 1!
  Simulator::Schedule(Seconds(7.0), [devR0_R1]() {
    std::cout << "\n>>> [SIMULATOR EVENT @ 7.0s]: Injecting bottleneck congestion on Path 1 (R0-R1)!\n";
    std::cout << ">>> DataRate throttled to 200 Kbps and buffer delay increased.\n\n";
    auto netDev = DynamicCast<PointToPointNetDevice>(devR0_R1.Get(0));
    if (netDev) {
      netDev->SetDataRate(DataRate("200Kbps"));
    }
  });

  // Re-enable normal conditions at t = 15.0s to demonstrate recovery
  Simulator::Schedule(Seconds(15.0), [devR0_R1]() {
    std::cout << "\n>>> [SIMULATOR EVENT @ 15.0s]: Congestion cleared on Path 1 (R0-R1)!\n\n";
    auto netDev = DynamicCast<PointToPointNetDevice>(devR0_R1.Get(0));
    if (netDev) {
      netDev->SetDataRate(DataRate("20Mbps"));
    }
  });

  // 9. Metric Tracers
  ndn::L3RateTracer::InstallAll("build/ade-rate-trace.txt", Seconds(0.5));

  Simulator::Stop(Seconds(20.0));
  Simulator::Run();
  Simulator::Destroy();

  std::cout << "\n======================================================\n";
  std::cout << "  Simulation Finished Successfully!\n";
  std::cout << "  Trace file generated: build/ade-rate-trace.txt\n";
  std::cout << "======================================================\n\n";

  return 0;
}

} // namespace ns3

int
main(int argc, char* argv[])
{
  return ns3::main(argc, argv);
}
