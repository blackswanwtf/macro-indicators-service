# Macro Indicators Analysis Prompt Management System

This directory contains versioned prompts for the macro economic indicators analysis service, making them easy to version control, edit, and manage.

## File Structure

```
prompts/
├── macro-analysis-v1.md       # Current prompt template
├── prompt-config.js           # Prompt management system
└── README.md                  # This file
```

## Usage

### Using Different Prompt Versions

```javascript
// Use current version (default)
const prompt = promptManager.getFilledPrompt(templateData);

// Use specific version
const prompt = promptManager.getFilledPrompt(
  templateData,
  "macro-analysis",
  "v1"
);
```

### Creating New Prompt Versions

1. **Copy existing version**: `cp macro-analysis-v1.md macro-analysis-v2.md`
2. **Edit the new version**: Modify the template as needed
3. **Update default version**:
   ```javascript
   promptManager.setDefaultVersion("v2");
   ```

### Template Variables

The prompt template uses `{{variable_name}}` syntax for placeholders:

- `{{timestamp}}` - Current analysis timestamp
- `{{lookback_hours}}` - Hours of data being analyzed
- `{{sp500_section}}` - Formatted S&P 500 analysis data
- `{{fear_greed_section}}` - Formatted Fear & Greed Index data
- `{{currency_section}}` - Formatted currency exchange data

## Prompt Evolution

### Version 1 (v1) - Initial Release

- Basic macro economic analysis structure
- 5-level economic condition classification (extremely healthy to critical)
- Cross-indicator correlation analysis
- Risk level assessment
- Key economic factors identification

### Future Versions

- Enhanced economic trend detection
- Sector-specific analysis integration
- Geopolitical factor correlation
- Advanced economic forecasting
- Multi-timeframe economic outlook

## Benefits

✅ **Version Control**: Easy to track prompt changes over time  
✅ **Easy Editing**: Edit prompts in markdown without touching code  
✅ **Testing**: Test different prompt versions without code changes  
✅ **Rollback**: Quickly revert to previous prompt versions  
✅ **Team Collaboration**: Non-developers can edit prompts  
✅ **A/B Testing**: Compare different prompt approaches

## Best Practices

1. **Clear Economic Focus**: Provide specific guidance on macro-economic analysis
2. **Structured Output**: Always require JSON format for consistent parsing
3. **Cross-Correlation**: Include analysis of relationships between indicators
4. **Risk Assessment**: Ask for comprehensive risk level evaluation
5. **Factor Identification**: Request key economic driver extraction
6. **Temporal Awareness**: Consider both current conditions and trend analysis
