# frozen_string_literal: true

require_relative '../lib/smart_routing'

module SmartRoutingApp
  class Application
    def self.root
      File.expand_path('..', __dir__)
    end
  end
end
