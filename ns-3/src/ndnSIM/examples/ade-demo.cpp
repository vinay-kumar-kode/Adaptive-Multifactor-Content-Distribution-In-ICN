#include <iostream>
#include <string>
#include <vector>
#include <limits>


struct PathMetrics {
  std::string name;
  double delayMs;
  double lossPercent;
  double linkCost;
  double cacheHitPercent;
};

double
calculateScore(const PathMetrics& p)
{
  // Lower delay, loss, and link cost are better.
  // Higher cache-hit percentage is better.
  return 0.40 * p.delayMs
       + 0.30 * p.lossPercent
       + 0.20 * p.linkCost
       + 0.10 * (100.0 - p.cacheHitPercent);
}

int
main(int argc, char* argv[])
{
  std::vector<PathMetrics> paths = {
    {"Path A", 80.0, 8.0, 10.0, 20.0},
    {"Path B", 25.0, 1.0, 15.0, 80.0}
  };
  std::cout << "\n========== ADE DECISION ENGINE ==========\n";
  std::cout << "Demonstration using sample network metrics\n\n";

  double bestScore = std::numeric_limits<double>::max();
  std::string selectedPath;

  for (const auto& path : paths) {
    double score = calculateScore(path);

    std::cout << path.name
              << " | Delay: " << path.delayMs << " ms"
              << " | Loss: " << path.lossPercent << "%"
              << " | Link cost: " << path.linkCost
              << " | Cache hit: " << path.cacheHitPercent << "%"
              << " | Score: " << score << '\n';

    if (score < bestScore) {
      bestScore = score;
      selectedPath = path.name;
    }
  }

  std::cout << "\nADE selected: " << selectedPath << '\n';
  std::cout << "Reason: it has the lowest weighted score.\n";
  std::cout << "=========================================\n\n";

  return 0;
}
