# Macro Economic Indicators Analysis

## Context

- **Timestamp**: {{timestamp}}
- **Analysis Period**: Last {{lookback_hours}} hours ({{lookback_minutes}} minutes), hourly data

## Inputs

### S&P 500

{{sp500_section}}

### Fear & Greed Index

{{fear_greed_section}}

### Currency Markets

{{currency_section}}

## Task

Analyze each indicator independently. Be concise, neutral, and factual. Focus on current state and recent change only. No cross‑indicator correlations or predictions.

Rules

- 2–3 sentences per section. Avoid adjectives and speculation.
- If data is missing or unclear, use "insufficient_data" for that part.
- Set "createdAt" to the current timestamp.

Respond with this EXACT JSON format:

```json
{
  "sp500_analysis": "Current S&P 500 status, trend direction, and recent performance changes",
  "fear_greed_analysis": "Current fear/greed level, sentiment interpretation, and any notable shifts (objective)",
  "currency_analysis": "Currency movements, volatility assessment, and what they suggest about stability",
  "analysis_summary": "Concise 2–3 sentence summary combining the three sections",
  "fear_greed_value": "Current Fear and Greed Value such as 45 (type number)",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

Notes

- Higher fear implies risk aversion; higher greed implies optimism. Treat both as neutral observations.
- Emphasize the present period; avoid long-term trend commentary.
