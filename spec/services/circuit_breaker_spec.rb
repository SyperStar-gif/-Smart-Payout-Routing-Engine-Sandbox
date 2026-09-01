# frozen_string_literal: true

require 'spec_helper'

RSpec.describe CircuitBreaker do
  subject(:breaker) { described_class.new(service_name: 'test_service', threshold: 3, cooldown_seconds: 5) }

  it 'starts in closed state' do
    expect(breaker.closed?).to be true
    expect(breaker.open?).to be false
  end

  it 'transitions to open state after threshold consecutive failures' do
    3.times { breaker.record_failure }
    expect(breaker.open?).to be true
  end

  it 'transitions to half_open after cooldown' do
    3.times { breaker.record_failure }
    expect(breaker.open?).to be true

    Timecop.travel(Time.now + 6) do
      expect(breaker.open?).to be false # Will evaluate half-open
    end
  end
end
