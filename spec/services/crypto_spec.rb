# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Crypto::PrecisionCalculator do
  it 'calculates 8-decimal cryptocurrency fees without float precision errors' do
    res = described_class.calculate(100.12345678, 0.5, 1.0, 8)
    expect(res[:calculated_fee]).to eq(1.50061728)
    expect(res[:net_amount]).to eq(98.6228395)
  end
end

RSpec.describe Crypto::AddressValidator do
  it 'correctly validates and detects TRC20 addresses' do
    res = described_class.validate('TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH', 'USDT')
    expect(res[:valid]).to be true
    expect(res[:network]).to eq(:trc20)
  end

  it 'correctly validates EVM addresses' do
    res = described_class.validate('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'USDT')
    expect(res[:valid]).to be true
    expect(res[:network]).to eq(:evm)
  end
end
