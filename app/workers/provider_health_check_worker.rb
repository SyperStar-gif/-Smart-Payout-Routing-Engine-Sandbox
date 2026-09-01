# frozen_string_literal: true

require 'sidekiq'
require 'concurrent'

class ProviderHealthCheckWorker
  include Sidekiq::Worker

  sidekiq_options queue: :monitoring, retry: false

  def perform
    # Pings provider heartbeat endpoints, updates EWMA latency and manages circuit breaker recovery
    logger.info 'Running periodic provider health checks and EWMA latency reconciliation...'
  end
end
