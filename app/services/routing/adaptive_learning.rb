# frozen_string_literal: true

module Routing
  class AdaptiveLearning
    # Automatically tunes routing weights and provider penalties based on rolling outcomes
    def self.reconcile_provider_metrics(provider, transaction_history)
      return provider.stats if transaction_history.empty?

      recent = transaction_history.last(100)
      successful = recent.select { |t| t[:status] == :settled }

      success_rate = ((successful.size.to_f / recent.size) * 100.0).round(2)
      avg_latency = successful.any? ? (successful.map { |t| t[:latency_ms] }.sum / successful.size.to_f).round(1) : 500.0

      # Calculate P95 latency
      sorted_latencies = successful.map { |t| t[:latency_ms] }.sort
      p95_idx = (sorted_latencies.size * 0.95).floor
      p95_latency = sorted_latencies[p95_idx] || avg_latency

      {
        success_rate: success_rate,
        latency_ewma_ms: avg_latency,
        p95_latency_ms: p95_latency,
        sample_size: recent.size
      }
    end
  end
end
