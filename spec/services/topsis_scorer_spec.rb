# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Routing::TopsisScorer do
  let(:prov_a) do
    PayoutProviders::Base.new(
      id: 'prov_a',
      name: 'Provider A (Low Fee, Med Latency)',
      fee_percent: 0.5,
      fee_fixed: 0.0,
      stats: { success_rate: 99.0, latency_ewma_ms: 250.0, volume_today: 10_000.0 }
    )
  end

  let(:prov_b) do
    PayoutProviders::Base.new(
      id: 'prov_b',
      name: 'Provider B (High Fee, Low Latency)',
      fee_percent: 2.5,
      fee_fixed: 0.0,
      stats: { success_rate: 99.5, latency_ewma_ms: 60.0, volume_today: 10_000.0 }
    )
  end

  it 'calculates TOPSIS scores and ranks optimal providers' do
    results = described_class.score([prov_a, prov_b], 1000.0)
    expect(results.size).to eq(2)
    expect(results.first[:score]).to be_between(0.0, 100.0)
    expect(results.first[:d_plus]).to be >= 0.0
    expect(results.first[:d_minus]).to be >= 0.0
  end
end
