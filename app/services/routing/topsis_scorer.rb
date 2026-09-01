# frozen_string_literal: true

module Routing
  class TopsisScorer
    # Implements TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution)
    # for optimal provider selection across 4 dimensions:
    # 1. Fee (Cost criterion - minimize)
    # 2. Success Rate (Benefit criterion - maximize)
    # 3. Latency EWMA (Cost criterion - minimize)
    # 4. Headroom Capacity (Benefit criterion - maximize)

    def self.score(providers, request_amount, weights = {})
      return [] if providers.empty?

      w_fee = weights[:fee] || 0.35
      w_sr = weights[:success_rate] || 0.30
      w_lat = weights[:latency] || 0.20
      w_cap = weights[:headroom] || 0.15

      # 1. Build Decision Matrix [Fee, SR, Latency, Headroom]
      matrix = providers.map do |provider|
        fee = provider.calculate_fee(request_amount)
        sr = provider.stats[:success_rate].to_f
        lat = provider.stats[:latency_ewma_ms].to_f
        used = provider.stats[:volume_today].to_f
        limit = provider.daily_limit.to_f
        headroom = limit.positive? ? [limit - used, 0.0].max : 1_000_000.0

        [fee, sr, lat, headroom]
      end

      # 2. Vector Normalization
      col_sums_sq = (0..3).map do |col_idx|
        Math.sqrt(matrix.map { |row| row[col_idx]**2 }.sum)
      end

      norm_matrix = matrix.map do |row|
        [
          col_sums_sq[0].positive? ? (row[0] / col_sums_sq[0]) * w_fee : 0.0,
          col_sums_sq[1].positive? ? (row[1] / col_sums_sq[1]) * w_sr : 0.0,
          col_sums_sq[2].positive? ? (row[2] / col_sums_sq[2]) * w_lat : 0.0,
          col_sums_sq[3].positive? ? (row[3] / col_sums_sq[3]) * w_cap : 0.0
        ]
      end

      # 3. Determine Ideal Best (A+) and Ideal Worst (A-)
      ideal_best = [
        norm_matrix.map { |r| r[0] }.min, # Fee: minimize
        norm_matrix.map { |r| r[1] }.max, # SR: maximize
        norm_matrix.map { |r| r[2] }.min, # Latency: minimize
        norm_matrix.map { |r| r[3] }.max  # Headroom: maximize
      ]

      ideal_worst = [
        norm_matrix.map { |r| r[0] }.max,
        norm_matrix.map { |r| r[1] }.min,
        norm_matrix.map { |r| r[2] }.max,
        norm_matrix.map { |r| r[3] }.min
      ]

      # 4. Calculate Euclidean Distances and Closeness Coefficient
      providers.each_with_index.map do |provider, idx|
        row = norm_matrix[idx]
        d_plus = Math.sqrt((0..3).map { |c| (row[c] - ideal_best[c])**2 }.sum)
        d_minus = Math.sqrt((0..3).map { |c| (row[c] - ideal_worst[c])**2 }.sum)

        total_d = d_plus + d_minus
        score = total_d.positive? ? (d_minus / total_d) * 100.0 : 50.0

        {
          provider: provider,
          score: score.round(2),
          d_plus: d_plus.round(4),
          d_minus: d_minus.round(4)
        }
      end.sort_by { |item| -item[:score] }
    end
  end
end
