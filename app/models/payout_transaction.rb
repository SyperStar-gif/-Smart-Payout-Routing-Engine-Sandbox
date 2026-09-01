# frozen_string_literal: true

class PayoutTransaction
  STATUSES = %w[pending processing settled failed cancelled rejected].freeze

  attr_accessor :id, :amount, :currency, :country, :method, :recipient_identifier,
                :recipient_name, :provider_id, :status, :fee_amount, :tx_hash,
                :attempts, :error_message, :idempotency_key, :created_at, :settled_at

  def initialize(attributes = {})
    attributes.each do |key, value|
      public_send("#{key}=", value) if respond_to?("#{key}=")
    end
    @id ||= "tx_#{SecureRandom.hex(8)}"
    @status ||= 'pending'
    @attempts ||= 0
    @created_at ||= Time.now
  end

  def settled?
    status == 'settled'
  end

  def failed?
    status == 'failed'
  end

  def rejected?
    status == 'rejected'
  end

  def to_h
    {
      id: id,
      amount: amount,
      currency: currency,
      country: country,
      method: method,
      recipient_identifier: recipient_identifier,
      recipient_name: recipient_name,
      provider_id: provider_id,
      status: status,
      fee_amount: fee_amount,
      tx_hash: tx_hash,
      attempts: attempts,
      error_message: error_message,
      idempotency_key: idempotency_key,
      created_at: created_at,
      settled_at: settled_at
    }
  end
end
