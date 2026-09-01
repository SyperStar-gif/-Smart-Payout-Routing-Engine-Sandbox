# frozen_string_literal: true

require 'concurrent'

module Routing
  class BatchProcessor
    # Processes multiple payout requests concurrently with a bounded thread pool
    def self.process_batch(router, requests, max_concurrency: 5)
      pool = Concurrent::FixedThreadPool.new(max_concurrency)
      promises = requests.map do |req|
        Concurrent::Promise.execute(executor: pool) do
          router.route_and_execute(req)
        end
      end

      results = promises.map(&:value!)
      pool.shutdown
      pool.wait_for_termination(10)

      success_count = results.count(&:success)
      failure_count = results.size - success_count

      {
        total: results.size,
        successful: success_count,
        failed: failure_count,
        results: results
      }
    end
  end
end
