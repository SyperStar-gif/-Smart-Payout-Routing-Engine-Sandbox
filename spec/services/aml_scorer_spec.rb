# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Risk::AmlScorer do
  it 'rejects transactions from sanctioned countries with CRITICAL risk' do
    req = {
      country: 'KP',
      currency: 'USD',
      amount: 100
    }
    result = described_class.assess(req)
    expect(result[:risk_level]).to eq(:critical)
    expect(result[:action]).to eq(:reject)
    expect(result[:risk_score]).to be >= 75
  end

  it 'flags cryptocurrency mixer addresses' do
    req = {
      country: 'RU',
      currency: 'USDT',
      method: 'crypto',
      recipient: { account_identifier: '0x123tornadoCash456' }
    }
    result = described_class.assess(req)
    expect(result[:risk_level]).to eq(:critical)
    expect(result[:action]).to eq(:reject)
  end

  it 'triggers 115-FZ threshold for payouts above 600,000 RUB' do
    req = {
      country: 'RU',
      currency: 'RUB',
      amount: 650_000
    }
    result = described_class.assess(req)
    expect(result[:requires_enhanced_kyc]).to be true
  end
end
