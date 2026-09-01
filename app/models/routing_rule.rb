# frozen_string_literal: true

class RoutingRule
  ACTION_TYPES = %i[boost_provider force_provider exclude_provider set_weight_preset].freeze

  attr_accessor :id, :name, :description, :enabled, :priority,
                :condition_currency, :condition_country, :condition_method,
                :condition_min_amount, :condition_max_amount,
                :action_type, :target_provider_id, :boost_multiplier, :custom_weights

  def initialize(attributes = {})
    attributes.each do |key, value|
      public_send("#{key}=", value) if respond_to?("#{key}=")
    end
    @enabled = true if @enabled.nil?
    @priority ||= 100
    @action_type = @action_type&.to_sym
  end

  def enabled?
    @enabled == true
  end

  def matches?(request)
    return false unless enabled?

    if condition_currency && !condition_currency.to_s.empty? && request[:currency].to_s.upcase != condition_currency.to_s.upcase
      return false
    end

    if condition_country && !condition_country.to_s.empty? && request[:country].to_s.upcase != condition_country.to_s.upcase
      return false
    end

    if condition_method && !condition_method.to_s.empty? && request[:method].to_s != condition_method.to_s
      return false
    end

    amount = request[:amount].to_f
    if !condition_min_amount.nil? && amount < condition_min_amount.to_f
      return false
    end

    if !condition_max_amount.nil? && amount > condition_max_amount.to_f
      return false
    end

    true
  end
end
