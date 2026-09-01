# frozen_string_literal: true

require 'concurrent'

class CircuitBreaker
  STATES = %i[closed open half_open].freeze

  attr_reader :service_name, :state, :failure_count, :success_count,
              :threshold, :cooldown_seconds, :last_state_change

  def initialize(service_name:, threshold: 5, cooldown_seconds: 30)
    @service_name = service_name
    @threshold = threshold
    @cooldown_seconds = cooldown_seconds
    @state = :closed
    @failure_count = 0
    @success_count = 0
    @last_state_change = Concurrent.monotonic_time
    @lock = Mutex.new
  end

  def open?
    @lock.synchronize do
      check_cooldown_transition
      @state == :open
    end
  end

  def closed?
    !open?
  end

  def record_success
    @lock.synchronize do
      if @state == :half_open
        @success_count += 1
        if @success_count >= 3
          transition_to(:closed)
        end
      else
        @failure_count = 0
      end
    end
  end

  def record_failure
    @lock.synchronize do
      @failure_count += 1
      if @state == :half_open || @failure_count >= @threshold
        transition_to(:open)
      end
    end
  end

  private

  def check_cooldown_transition
    return unless @state == :open

    elapsed = Concurrent.monotonic_time - @last_state_change
    if elapsed >= @cooldown_seconds
      transition_to(:half_open)
    end
  end

  def transition_to(new_state)
    @state = new_state
    @failure_count = 0
    @success_count = 0
    @last_state_change = Concurrent.monotonic_time
  end
end
