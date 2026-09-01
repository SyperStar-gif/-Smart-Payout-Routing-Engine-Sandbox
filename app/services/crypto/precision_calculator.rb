# frozen_string_literal: true

require 'bigdecimal'
require 'bigdecimal/util'

module Crypto
  class PrecisionCalculator
    # Calculates cryptocurrency network fees and net amounts with 8 decimal places
    # without floating-point IEEE-754 epsilon artifacts.
    def self.calculate(amount, fee_percent = 0.5, fee_fixed = 1.0, precision = 8)
      dec_amount = BigDecimal(amount.to_s)
      dec_percent = BigDecimal(fee_percent.to_s) / BigDecimal('100')
      dec_fixed = BigDecimal(fee_fixed.to_s)

      calculated_fee = ((dec_amount * dec_percent) + dec_fixed).round(precision, BigDecimal::ROUND_HALF_UP)
      net_amount = (dec_amount - calculated_fee).round(precision, BigDecimal::ROUND_HALF_UP)

      {
        gross_amount: dec_amount.to_f,
        calculated_fee: calculated_fee.to_f,
        net_amount: net_amount.to_f,
        effective_rate: ((calculated_fee / dec_amount) * BigDecimal('100')).round(4).to_f
      }
    end
  end
end
