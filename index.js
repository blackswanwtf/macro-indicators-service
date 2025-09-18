/**
 * Black Swan Macro Economic Indicators Analysis Service
 *
 * This service provides AI-powered analysis of macro economic indicators including:
 * - Fear & Greed Index (crypto market sentiment)
 * - S&P 500 stock market performance
 * - Currency exchange rates (major pairs)
 *
 * The service collects data from external APIs, processes it into hourly aggregates,
 * calculates key metrics, and uses AI (OpenRouter/GPT) to generate comprehensive
 * market condition analysis reports.
 *
 * Author: Muhammad Bilal Motiwala
 * Project: Black Swan
 * Version: 1.0.0
 */

// Load environment variables from .env file
require("dotenv").config();

// Core Express.js dependencies for web server functionality
const express = require("express");
const cors = require("cors"); // Cross-Origin Resource Sharing middleware
const helmet = require("helmet"); // Security headers middleware
const rateLimit = require("express-rate-limit"); // Rate limiting middleware
const compression = require("compression"); // Response compression middleware

// Firebase Admin SDK for Firestore database operations
const admin = require("firebase-admin");

// HTTP client for making API requests to external services
const axios = require("axios");

// Cron job scheduler for automated periodic analysis
const cron = require("node-cron");

// Custom prompt management system for AI analysis templates
const MacroPromptManager = require("./prompts/prompt-config");

/**
 * Firebase Admin SDK Initialization
 *
 * Initializes Firebase Admin SDK using the service account key file.
 * This provides authenticated access to Firestore database for storing
 * analysis results and retrieving historical data.
 */
try {
  // Load Firebase service account credentials from JSON file
  const serviceAccount = require("./serviceAccountKey.json");

  // Initialize Firebase Admin with service account credentials
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ [FIREBASE] Firebase Admin initialized successfully");
} catch (error) {
  console.error("❌ [FIREBASE] Failed to initialize Firebase Admin:", error);
  process.exit(1);
}

// Get Firestore database instance for data operations
const db = admin.firestore();

/**
 * Service Configuration
 *
 * Centralized configuration object containing all service settings,
 * API endpoints, timing intervals, and collection names.
 */
const CONFIG = {
  // Server port - defaults to 8084 if not specified in environment
  PORT: process.env.PORT || 8084,

  // OpenRouter API credentials for AI analysis (required)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",

  // External data service URL for fetching macro indicators data
  DATA_SERVICE_URL: process.env.DATA_SERVICE_URL,

  // Cron schedule for automated analysis (runs at 58 minutes past every hour)
  // Format: "minute hour day month dayOfWeek"
  ANALYSIS_INTERVAL: "58 * * * *", // Every hour at 58 minutes

  // Data collection period - how many hours of historical data to analyze
  LOOKBACK_HOURS: 168, // 7 days of hourly data for comprehensive trend analysis

  // Firestore collection name for storing analysis results
  MACRO_COLLECTION: "macro_indicators_analysis",
};

/**
 * Configuration Validation
 *
 * Validates that all required environment variables are present
 * before starting the service. Exits with error code 1 if critical
 * configuration is missing.
 */
if (!CONFIG.OPENROUTER_API_KEY) {
  console.error("❌ [CONFIG] OPENROUTER_API_KEY is required");
  process.exit(1);
}

/**
 * Macro Data Collector Class
 *
 * Responsible for collecting macro economic indicator data from external APIs.
 * Fetches Fear & Greed Index, S&P 500 prices, and currency exchange rates,
 * then aggregates minute-level data into hourly intervals for analysis.
 */
class MacroDataCollector {
  /**
   * Collect macro economic indicator data from external data service
   *
   * @param {number} lookbackHours - Number of hours of historical data to collect (default: 168 = 7 days)
   * @returns {Object} Aggregated macro data containing S&P 500, currency, and fear/greed data
   * @throws {Error} If data collection fails or external service is unavailable
   */
  async collectMacroData(lookbackHours = CONFIG.LOOKBACK_HOURS) {
    try {
      console.log(
        `📊 [DATA] Collecting macro indicators for last ${lookbackHours} hours (${Math.round(
          lookbackHours / 24
        )} days)...`
      );

      // Make parallel API requests to external data service for all three indicators
      // Each request has a 10-second timeout to prevent hanging
      const [sp500Response, fearGreedResponse, currencyResponse] =
        await Promise.all([
          // Fetch S&P 500 price data for the specified time period
          axios.get(`${CONFIG.DATA_SERVICE_URL}/sp500?hours=${lookbackHours}`, {
            timeout: 10000,
          }),
          // Fetch current Fear & Greed Index data (no time period needed)
          axios.get(`${CONFIG.DATA_SERVICE_URL}/fear-greed`, {
            timeout: 10000,
          }),
          // Fetch currency exchange rate data for the specified time period
          axios.get(
            `${CONFIG.DATA_SERVICE_URL}/currency?hours=${lookbackHours}`,
            {
              timeout: 10000,
            }
          ),
        ]);

      // Extract raw data from API responses (fallback to empty array if no data)
      const sp500Raw = sp500Response.data.data || [];
      const currencyRaw = currencyResponse.data.data || [];
      const fearGreedRaw = fearGreedResponse.data.data || [];

      // Convert minute-level data to hourly aggregates for trend analysis
      const sp500Data = this.aggregateToHourly(sp500Raw, "price");
      const currencyData = this.aggregateCurrencyToHourly(currencyRaw);

      // Process Fear & Greed data (handles various response structures from the API)
      let fearGreedData = null;

      // Case 1: Data is an array with multiple entries (take the latest)
      if (
        fearGreedRaw &&
        Array.isArray(fearGreedRaw) &&
        fearGreedRaw.length > 0
      ) {
        const latestData = fearGreedRaw[fearGreedRaw.length - 1];
        // Extract crypto_fear_greed data from the latest entry
        if (latestData.crypto_fear_greed) {
          fearGreedData = {
            value: latestData.crypto_fear_greed.value,
            classification: latestData.crypto_fear_greed.classification,
            timestamp: latestData.timestamp || latestData.collected_at,
          };
        }
      }
      // Case 2: Data is directly in response.data (single object)
      else if (
        fearGreedResponse.data &&
        fearGreedResponse.data.crypto_fear_greed
      ) {
        fearGreedData = {
          value: fearGreedResponse.data.crypto_fear_greed.value,
          classification:
            fearGreedResponse.data.crypto_fear_greed.classification,
          timestamp:
            fearGreedResponse.data.timestamp ||
            fearGreedResponse.data.collected_at,
        };
      }
      // Case 3: Data is nested in data.data as a single object
      else if (
        fearGreedResponse.data &&
        fearGreedResponse.data.data &&
        !Array.isArray(fearGreedResponse.data.data) &&
        fearGreedResponse.data.data.crypto_fear_greed
      ) {
        const data = fearGreedResponse.data.data;
        fearGreedData = {
          value: data.crypto_fear_greed.value,
          classification: data.crypto_fear_greed.classification,
          timestamp: data.timestamp || data.collected_at,
        };
      }

      // Compile all collected data into a structured object
      const macroData = {
        sp500: sp500Data, // Hourly aggregated S&P 500 price data
        currency: currencyData, // Hourly aggregated currency exchange rates
        fearGreed: fearGreedData, // Current Fear & Greed Index value
        timestamp: Date.now(), // Collection timestamp
      };

      // Log collection statistics for monitoring and debugging
      console.log(
        `📊 [DATA] Collected ${macroData.sp500.length} S&P 500 hourly intervals (target: ${lookbackHours} hours)`
      );
      console.log(
        `📊 [DATA] Collected ${macroData.currency.length} Currency hourly intervals (target: ${lookbackHours} hours)`
      );
      console.log(
        `📊 [DATA] Current Fear & Greed: ${
          macroData.fearGreed && macroData.fearGreed.value !== undefined
            ? macroData.fearGreed.value
            : "N/A"
        }`
      );

      return macroData;
    } catch (error) {
      console.error("❌ [DATA] Error collecting macro data:", error);
      throw error;
    }
  }

  /**
   * Aggregate minute-level data to hourly intervals
   *
   * Converts high-frequency minute data into hourly aggregates by taking
   * the last (most recent) value within each hour as the representative value.
   * This reduces noise while preserving trend information.
   *
   * @param {Array} minuteData - Array of minute-level data points with timestamps
   * @param {string} priceField - Field name containing the price/value to aggregate
   * @returns {Array} Array of hourly aggregated data points
   */
  aggregateToHourly(minuteData, priceField) {
    // Return empty array if no data provided
    if (!minuteData || minuteData.length === 0) return [];

    const hourlyData = {};

    // Process each minute-level data point
    minuteData.forEach((item) => {
      // Skip invalid data points
      if (!item.timestamp || !item[priceField]) return;

      // Round timestamp down to the nearest hour (e.g., 14:30:00 becomes 14:00:00)
      const hourTimestamp =
        Math.floor(item.timestamp / (1000 * 60 * 60)) * (1000 * 60 * 60);

      // Keep the latest price for each hour (last price of the hour)
      // This ensures we capture the most recent value within each hour
      if (
        !hourlyData[hourTimestamp] ||
        item.timestamp > hourlyData[hourTimestamp].timestamp
      ) {
        hourlyData[hourTimestamp] = {
          timestamp: hourTimestamp, // Hourly timestamp
          [priceField]: item[priceField], // Price/value for this hour
          original_timestamp: item.timestamp, // Keep original timestamp for reference
        };
      }
    });

    // Convert object to array and sort chronologically
    return Object.values(hourlyData).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Aggregate currency minute-level data to hourly intervals
   *
   * Similar to aggregateToHourly but specifically handles currency data which
   * contains multiple exchange rate pairs (USD/EUR, USD/GBP, etc.) in each record.
   *
   * @param {Array} minuteData - Array of minute-level currency data with multiple exchange rates
   * @returns {Array} Array of hourly aggregated currency data with all exchange rate pairs
   */
  aggregateCurrencyToHourly(minuteData) {
    // Return empty array if no data provided
    if (!minuteData || minuteData.length === 0) return [];

    const hourlyData = {};

    // Process each minute-level currency data point
    minuteData.forEach((item) => {
      // Skip invalid data points (must have timestamp)
      if (!item.timestamp) return;

      // Round timestamp down to the nearest hour
      const hourTimestamp =
        Math.floor(item.timestamp / (1000 * 60 * 60)) * (1000 * 60 * 60);

      // Keep the latest exchange rates for each hour
      // This preserves all currency pairs (USD/EUR, USD/GBP, etc.) from the most recent minute
      if (
        !hourlyData[hourTimestamp] ||
        item.timestamp > hourlyData[hourTimestamp].timestamp
      ) {
        hourlyData[hourTimestamp] = {
          timestamp: hourTimestamp, // Hourly timestamp
          ...item, // Copy all currency pair data (USD/EUR, USD/GBP, etc.)
          original_timestamp: item.timestamp, // Keep original timestamp for reference
        };
      }
    });

    // Convert object to array and sort chronologically
    return Object.values(hourlyData).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate key metrics for hourly intervals
   *
   * Analyzes the collected macro data to compute important statistical metrics
   * including trends, volatility, and percentage changes for each indicator.
   *
   * @param {Object} macroData - Collected macro data containing S&P 500, currency, and fear/greed data
   * @returns {Object} Calculated metrics for each indicator type
   */
  calculateMacroMetrics(macroData) {
    // Calculate metrics for each indicator type
    const metrics = {
      sp500: this.calculateSP500Metrics(macroData.sp500),
      fearGreed: this.calculateFearGreedMetrics(macroData.fearGreed),
      currency: this.calculateCurrencyMetrics(macroData.currency),
    };

    return metrics;
  }

  /**
   * Calculate S&P 500 specific metrics
   *
   * Computes current price, overall percentage change, trend analysis,
   * recent momentum, and volatility for S&P 500 data.
   *
   * @param {Array} sp500Data - Array of hourly S&P 500 price data
   * @returns {Object} S&P 500 metrics including current price, trends, and volatility
   */
  calculateSP500Metrics(sp500Data) {
    // Return insufficient data if less than 2 data points
    if (!sp500Data || sp500Data.length < 2) {
      return { current: null, overallChange: null, trend: "insufficient_data" };
    }

    // Get first and last data points for overall change calculation
    const current = sp500Data[sp500Data.length - 1];
    const first = sp500Data[0];

    // Calculate overall percentage change across the entire lookback period
    const overallChange =
      current && first
        ? ((current.price - first.price) / first.price) * 100
        : null;

    // Calculate trend based on all available data points
    const prices = sp500Data.map((d) => d.price);
    const trend = this.calculateTrend(prices);

    // Calculate recent momentum using the last 20% of data points (minimum 5 points)
    const recentCount = Math.max(Math.floor(sp500Data.length * 0.2), 5);
    const recentData = sp500Data.slice(-recentCount);
    const recentTrend = this.calculateTrend(recentData.map((d) => d.price));

    return {
      current: current ? current.price : null, // Current S&P 500 price
      overallChange: overallChange // Overall % change over lookback period
        ? parseFloat(overallChange.toFixed(2))
        : null,
      trend, // Overall trend (bullish/bearish/sideways)
      recentTrend, // Recent trend (last 20% of data)
      dataPoints: sp500Data.length, // Number of data points analyzed
      volatility: this.calculateVolatility(prices), // Price volatility (standard deviation)
    };
  }

  /**
   * Calculate Fear & Greed Index specific metrics
   *
   * Processes the Fear & Greed Index data to extract current value,
   * classification, and sentiment interpretation.
   *
   * @param {Object} fearGreedData - Fear & Greed Index data object
   * @returns {Object} Fear & Greed metrics including value, sentiment, and classification
   */
  calculateFearGreedMetrics(fearGreedData) {
    // Return unknown values if no fear/greed data available
    if (!fearGreedData) {
      return { current: null, sentiment: "unknown", classification: null };
    }

    // Interpret the numerical value into a sentiment category
    const sentiment = this.interpretFearGreedValue(fearGreedData.value);

    return {
      current: fearGreedData.value, // Current Fear & Greed Index value (0-100)
      classification: fearGreedData.classification, // API-provided classification
      sentiment, // Interpreted sentiment (extreme_fear, fear, neutral, greed, extreme_greed)
      timestamp: fearGreedData.timestamp, // When the data was collected
    };
  }

  /**
   * Calculate currency exchange rate specific metrics
   *
   * Analyzes currency exchange rate data to compute metrics for each currency pair,
   * including current rates, percentage changes, trends, and overall market volatility.
   *
   * @param {Array} currencyData - Array of hourly currency exchange rate data
   * @returns {Object} Currency metrics including individual pair analysis and market overview
   */
  calculateCurrencyMetrics(currencyData) {
    // Return insufficient data if less than 2 data points
    if (!currencyData || currencyData.length < 2) {
      return { pairs: {}, overview: "insufficient_data" };
    }

    // Get first and last data points for change calculations
    const current = currencyData[currencyData.length - 1];
    const first = currencyData[0];

    const pairs = {};

    // Analyze each currency pair (USD/EUR, USD/GBP, etc.) across the lookback period
    if (current && first) {
      Object.keys(current).forEach((pair) => {
        // Skip timestamp field and only process valid currency pairs
        if (pair !== "timestamp" && current[pair] && first[pair]) {
          // Calculate overall percentage change for this pair
          const overallChange =
            ((current[pair] - first[pair]) / first[pair]) * 100;

          // Calculate volatility and trend for this specific pair
          const pairValues = currencyData
            .filter((d) => d[pair])
            .map((d) => d[pair]);
          const volatility = this.calculateVolatility(pairValues);
          const trend = this.calculateTrend(pairValues);

          pairs[pair] = {
            current: current[pair], // Current exchange rate
            overallChange: parseFloat(overallChange.toFixed(4)), // % change over lookback period
            trend, // Trend direction (bullish/bearish/sideways)
            volatility: parseFloat(volatility.toFixed(4)), // Volatility (standard deviation)
          };
        }
      });
    }

    // Calculate overall currency market stability based on average volatility
    const changes = Object.values(pairs).map((p) =>
      Math.abs(p.overallChange || 0)
    );
    const avgVolatility =
      changes.length > 0
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : 0;

    // Classify overall market volatility
    const overview =
      avgVolatility > 2.0
        ? "high_volatility"
        : avgVolatility > 1.0
        ? "moderate_volatility"
        : "low_volatility";

    return {
      pairs, // Individual currency pair metrics
      overview, // Overall market volatility classification
      avgVolatility: parseFloat(avgVolatility.toFixed(4)), // Average volatility across all pairs
      dataPoints: currencyData.length, // Number of data points analyzed
    };
  }

  /**
   * Calculate trend direction from price data
   *
   * Determines the overall trend direction by analyzing the ratio of
   * price increases to decreases over the data period.
   *
   * @param {Array} prices - Array of price values
   * @returns {string} Trend direction: "bullish", "bearish", "sideways", or "insufficient_data"
   */
  calculateTrend(prices) {
    // Need at least 3 data points to determine a trend
    if (prices.length < 3) return "insufficient_data";

    // Count the number of price increases (current price > previous price)
    const increases = prices.slice(1).reduce((count, price, i) => {
      return price > prices[i] ? count + 1 : count;
    }, 0);

    // Calculate the ratio of increases to total price changes
    const ratio = increases / (prices.length - 1);

    // Classify trend based on increase ratio
    if (ratio > 0.6) return "bullish"; // More than 60% increases
    if (ratio < 0.4) return "bearish"; // Less than 40% increases
    return "sideways"; // Between 40-60% increases
  }

  /**
   * Interpret Fear & Greed Index numerical value into sentiment category
   *
   * Converts the numerical Fear & Greed Index value (0-100) into
   * a descriptive sentiment category for easier interpretation.
   *
   * @param {number} value - Fear & Greed Index value (0-100)
   * @returns {string} Sentiment category: "extreme_fear", "fear", "neutral", "greed", "extreme_greed", or "unknown"
   */
  interpretFearGreedValue(value) {
    if (value === null) return "unknown";
    if (value <= 25) return "extreme_fear"; // 0-25: Extreme fear (market panic)
    if (value <= 45) return "fear"; // 26-45: Fear (cautious sentiment)
    if (value <= 55) return "neutral"; // 46-55: Neutral (balanced sentiment)
    if (value <= 75) return "greed"; // 56-75: Greed (optimistic sentiment)
    return "extreme_greed"; // 76-100: Extreme greed (market euphoria)
  }

  /**
   * Calculate volatility (standard deviation) from price values
   *
   * Computes the standard deviation of price values to measure
   * market volatility and price stability.
   *
   * @param {Array} values - Array of price/rate values
   * @returns {number} Standard deviation (volatility measure)
   */
  calculateVolatility(values) {
    // Need at least 2 values to calculate volatility
    if (!values || values.length < 2) return 0;

    // Calculate the mean (average) of all values
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate variance (average of squared differences from mean)
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length;

    // Return standard deviation (square root of variance)
    return Math.sqrt(variance);
  }
}

/**
 * Macro Analysis Engine
 *
 * Handles AI-powered analysis of macro economic indicators using OpenRouter/GPT.
 * Takes collected data and calculated metrics, then generates comprehensive
 * market condition analysis reports through structured AI prompts.
 */
class MacroAnalysisEngine {
  /**
   * Initialize the analysis engine with prompt management system
   */
  constructor() {
    this.promptManager = new MacroPromptManager();
  }

  /**
   * Analyze macro economic indicators using AI
   *
   * Sends collected data and calculated metrics to OpenRouter/GPT for
   * comprehensive analysis. Returns structured analysis results including
   * individual indicator assessments and overall market summary.
   *
   * @param {Object} macroData - Collected macro data (S&P 500, currency, fear/greed)
   * @param {Object} metrics - Calculated metrics for each indicator
   * @returns {Object} AI-generated analysis results with structured insights
   * @throws {Error} If AI analysis fails or response parsing fails
   */
  async analyzeMacroIndicators(macroData, metrics) {
    try {
      console.log("🧠 [ANALYSIS] Running AI macro indicators analysis...");

      // Build the analysis prompt with collected data and metrics
      const prompt = this.buildAnalysisPrompt(macroData, metrics);

      // Send request to OpenRouter API for AI analysis
      const response = await axios.post(
        `${CONFIG.OPENROUTER_BASE_URL}/chat/completions`,
        {
          model: "openai/gpt-5-mini", // Use GPT-5 Mini model for analysis
          messages: [
            {
              role: "system",
              content:
                "You are an expert macro-economic analyst specializing in Fear & Greed Index, S&P 500, and currency market analysis. You analyze each indicator independently to provide context about current global financial market conditions and economic environment. Focus on current state and recent changes rather than correlations between indicators.",
            },
            {
              role: "user",
              content: prompt, // The structured prompt with data
            },
          ],
          max_tokens: 10000, // Maximum response length
          temperature: 0.3, // Low temperature for consistent analysis
        },
        {
          headers: {
            Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`, // API authentication
            "Content-Type": "application/json",
            "X-Title": "Macro Indicators Analysis - Economic Conditions", // Request title
          },
          timeout: 60000, // 60-second timeout
        }
      );

      // Extract the AI response content
      const content = response.data.choices[0].message.content.trim();

      // Parse the JSON response from AI (handles both raw JSON and markdown-wrapped JSON)
      let result;
      try {
        // Try to extract JSON from markdown code blocks first
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1]);
        } else {
          // Parse as raw JSON
          result = JSON.parse(content);
        }
      } catch (parseError) {
        console.error("❌ [ANALYSIS] JSON parsing failed:", parseError);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Validate that all required analysis fields are present
      if (
        !result.sp500_analysis ||
        !result.fear_greed_analysis ||
        !result.currency_analysis ||
        !result.analysis_summary
      ) {
        throw new Error("AI response missing required analysis fields");
      }

      // Ensure timestamp is present for record keeping
      if (!result.createdAt) {
        result.createdAt = new Date().toISOString();
      }

      console.log(
        "✅ [ANALYSIS] Macro indicators analysis completed successfully"
      );
      console.log(
        `📊 [RESULT] Fear/Greed Value: ${result.fear_greed_value || "N/A"}`
      );

      return result;
    } catch (error) {
      console.error("❌ [ANALYSIS] Analysis failed:", error);
      throw error;
    }
  }

  /**
   * Build structured analysis prompt for AI
   *
   * Formats the collected data and calculated metrics into a structured
   * prompt that the AI can analyze to generate comprehensive insights.
   *
   * @param {Object} macroData - Collected macro data
   * @param {Object} metrics - Calculated metrics for each indicator
   * @returns {string} Formatted prompt ready for AI analysis
   */
  buildAnalysisPrompt(macroData, metrics) {
    // Format S&P 500 data section for the prompt
    const sp500Section = `
**Current S&P 500**: ${metrics.sp500.current || "N/A"}
**Overall Change (${CONFIG.LOOKBACK_HOURS} hours)**: ${
      metrics.sp500.overallChange || "N/A"
    }%
**Trend**: ${metrics.sp500.trend}
**Recent Trend**: ${metrics.sp500.recentTrend || "N/A"}
**Volatility**: ${metrics.sp500.volatility || "N/A"}
**Data Points**: ${metrics.sp500.dataPoints} hourly intervals`;

    // Format Fear & Greed Index data section for the prompt
    const fearGreedSection = `
**Current Index**: ${metrics.fearGreed.current || "N/A"}
**Classification**: ${metrics.fearGreed.classification || "N/A"}
**Sentiment**: ${metrics.fearGreed.sentiment}
**Timestamp**: ${metrics.fearGreed.timestamp || "N/A"}`;

    // Format currency exchange rate data section for the prompt
    const currencyPairs = Object.entries(metrics.currency.pairs)
      .map(
        ([pair, data]) =>
          `- **${pair}**: ${data.current} (${
            data.overallChange > 0 ? "+" : ""
          }${data.overallChange}% - ${data.trend}, volatility: ${
            data.volatility
          })`
      )
      .join("\n");

    const currencySection = `
**Market Overview**: ${metrics.currency.overview}
**Average Volatility**: ${metrics.currency.avgVolatility}%
**Currency Pairs (${CONFIG.LOOKBACK_HOURS} hours)**:
${currencyPairs || "No currency data available"}
**Data Points**: ${metrics.currency.dataPoints} hourly intervals`;

    // Prepare template data for prompt generation
    const templateData = {
      timestamp: new Date().toISOString(), // Current timestamp
      lookback_minutes: CONFIG.LOOKBACK_HOURS * 60, // Convert hours to minutes for template compatibility
      lookback_hours: CONFIG.LOOKBACK_HOURS, // Lookback period in hours
      sp500_section: sp500Section, // Formatted S&P 500 data
      fear_greed_section: fearGreedSection, // Formatted Fear & Greed data
      currency_section: currencySection, // Formatted currency data
    };

    // Generate the complete prompt using the prompt manager
    return this.promptManager.getFilledPrompt(templateData);
  }
}

/**
 * Firestore Storage Manager
 *
 * Handles all database operations for storing and retrieving macro analysis results.
 * Manages the persistence of analysis data in Firestore with proper indexing
 * and metadata for efficient querying and historical analysis.
 */
class MacroStorageManager {
  /**
   * Save macro analysis results to Firestore
   *
   * Stores the complete analysis results including AI insights, metadata,
   * and service information in the Firestore database for historical tracking.
   *
   * @param {Object} macroData - Original collected data (not stored, used for reference)
   * @param {Object} metrics - Calculated metrics (not stored, used for reference)
   * @param {Object} analysisResult - AI-generated analysis results to store
   * @returns {Object} Save result with analysis ID and metadata
   * @throws {Error} If database save operation fails
   */
  async saveMacroAnalysis(macroData, metrics, analysisResult) {
    try {
      // Prepare the document to be saved to Firestore
      const analysisDoc = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(), // Server timestamp for ordering
        analysisTime: new Date().toISOString(), // Human-readable analysis time

        // Store only the AI analysis results (input data and metrics are not persisted)
        analysis: analysisResult,

        // Service metadata for tracking and debugging
        serviceVersion: "1.0.0", // Service version
        model: "openai/gpt-5-mini", // AI model used
        provider: "openrouter", // AI provider
        dataCollectionPeriod: `${CONFIG.LOOKBACK_HOURS} hours`, // Data collection period
      };

      // Save the document to Firestore and get the document reference
      const docRef = await db
        .collection(CONFIG.MACRO_COLLECTION)
        .add(analysisDoc);

      console.log(`💾 [STORAGE] Macro analysis saved with ID: ${docRef.id}`);

      // Return summary information about the saved analysis
      return {
        analysisId: docRef.id, // Firestore document ID
        timestamp: analysisDoc.analysisTime, // Analysis timestamp
        fearGreedValue: analysisResult.fear_greed_value || null, // Current Fear & Greed value
        createdAt: analysisResult.createdAt, // AI analysis creation time
      };
    } catch (error) {
      console.error("❌ [STORAGE] Failed to save analysis:", error);
      throw error;
    }
  }

  /**
   * Retrieve recent macro analysis results from Firestore
   *
   * Fetches the most recent analysis results from the database,
   * ordered by timestamp in descending order (newest first).
   *
   * @param {number} limit - Maximum number of analyses to retrieve (default: 10)
   * @returns {Array} Array of recent analysis documents with metadata
   * @throws {Error} If database retrieval fails
   */
  async getRecentAnalysis(limit = 10) {
    try {
      // Query Firestore for recent analyses, ordered by timestamp (newest first)
      const snapshot = await db
        .collection(CONFIG.MACRO_COLLECTION)
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      // Convert Firestore documents to plain objects with document IDs
      const analyses = [];
      snapshot.forEach((doc) => {
        analyses.push({
          id: doc.id, // Firestore document ID
          ...doc.data(), // Document data (analysis results, metadata, etc.)
        });
      });

      return analyses;
    } catch (error) {
      console.error("❌ [STORAGE] Failed to retrieve analyses:", error);
      throw error;
    }
  }
}

/**
 * Main Macro Indicators Analysis Service
 *
 * Orchestrates the complete macro economic indicators analysis workflow.
 * Coordinates data collection, metric calculation, AI analysis, and result storage
 * to provide comprehensive market condition insights.
 */
class MacroIndicatorsService {
  /**
   * Initialize the service with all required components
   */
  constructor() {
    this.dataCollector = new MacroDataCollector(); // Handles data collection from external APIs
    this.analysisEngine = new MacroAnalysisEngine(); // Manages AI-powered analysis
    this.storageManager = new MacroStorageManager(); // Handles database operations
    this.isRunning = false; // Prevents concurrent analysis runs
  }

  /**
   * Perform complete macro indicators analysis workflow
   *
   * Executes the full analysis pipeline: data collection, metric calculation,
   * AI analysis, and result storage. Includes concurrency protection to prevent
   * multiple simultaneous analysis runs.
   *
   * @returns {Object|null} Analysis result with metadata, or null if skipped/failed
   * @throws {Error} If any step in the analysis pipeline fails
   */
  async performMacroAnalysis() {
    // Prevent concurrent analysis runs
    if (this.isRunning) {
      console.log("⚠️  [SERVICE] Analysis already running, skipping...");
      return null;
    }

    const startTime = Date.now();
    this.isRunning = true;

    try {
      console.log("🚀 [SERVICE] Starting macro indicators analysis cycle...");

      // Step 1: Collect macro economic indicator data from external APIs
      console.log("📊 [STEP 1] Collecting macro indicators data...");
      const macroData = await this.dataCollector.collectMacroData();

      // Validate that we have sufficient data for analysis
      if (
        macroData.sp500.length === 0 &&
        macroData.fearGreed === null &&
        macroData.currency.length === 0
      ) {
        console.log("⚠️  [SERVICE] No macro data found for analysis");
        return null;
      }

      // Step 2: Calculate statistical metrics from collected data
      console.log("🔧 [STEP 2] Calculating macro metrics...");
      const metrics = this.dataCollector.calculateMacroMetrics(macroData);

      // Step 3: Generate AI-powered analysis using OpenRouter/GPT
      console.log("🧠 [STEP 3] Analyzing macro indicators with AI...");
      const analysisResult = await this.analysisEngine.analyzeMacroIndicators(
        macroData,
        metrics
      );

      // Step 4: Persist analysis results to Firestore database
      console.log("💾 [STEP 4] Saving analysis results...");
      const saveResult = await this.storageManager.saveMacroAnalysis(
        macroData,
        metrics,
        analysisResult
      );

      // Log completion statistics
      const duration = Date.now() - startTime;
      console.log("✅ [SERVICE] Macro analysis completed successfully");
      console.log(`📊 [RESULT] Analysis ID: ${saveResult.analysisId}`);
      console.log(
        `📊 [RESULT] Fear/Greed Value: ${saveResult.fearGreedValue || "N/A"}`
      );
      console.log(`⏱️  [TIMING] Analysis completed in ${duration}ms`);

      return saveResult;
    } catch (error) {
      console.error("❌ [SERVICE] Macro analysis failed:", error);
      throw error;
    } finally {
      // Always reset the running flag, even if analysis fails
      this.isRunning = false;
    }
  }

  /**
   * Get recent analysis history from the database
   *
   * Retrieves the most recent macro analysis results for historical
   * tracking and trend analysis.
   *
   * @param {number} limit - Maximum number of analyses to retrieve (default: 10)
   * @returns {Array} Array of recent analysis documents
   */
  async getAnalysisHistory(limit = 10) {
    return await this.storageManager.getRecentAnalysis(limit);
  }
}

// Initialize the main service instance
const macroService = new MacroIndicatorsService();

/**
 * Express.js Web Server Setup
 *
 * Configures the Express.js web server with security middleware,
 * rate limiting, and API routes for the macro indicators service.
 */
const app = express();

// Security and performance middleware
app.use(helmet()); // Security headers
app.use(cors()); // Cross-origin resource sharing
app.use(compression()); // Response compression
app.use(express.json({ limit: "10mb" })); // JSON body parsing with size limit

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

/**
 * API Routes
 *
 * Defines the REST API endpoints for the macro indicators service,
 * including service information, analysis triggers, and data retrieval.
 */

// Root endpoint - Service information and available endpoints
app.get("/", (req, res) => {
  res.json({
    service: "Macro Economic Indicators Analysis Service",
    version: "1.0.0",
    status: "running",
    description:
      "AI-powered analysis of Fear/Greed Index, S&P 500, and Currency Exchange data",
    endpoints: {
      "/analyze": "POST - Trigger macro indicators analysis",
      "/history": "GET - Get recent analysis history",
      "/status": "GET - Service status and metrics",
    },
  });
});

// Analysis trigger endpoint - Manually trigger macro indicators analysis
app.post("/analyze", async (req, res) => {
  try {
    const result = await macroService.performMacroAnalysis();

    if (!result) {
      return res.json({
        success: true,
        message: "No macro data found or analysis skipped",
        result: null,
      });
    }

    res.json({
      success: true,
      message: "Macro indicators analysis completed successfully",
      result,
    });
  } catch (error) {
    console.error("❌ [API] Analysis request failed:", error);
    res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message,
    });
  }
});

// History endpoint - Retrieve recent analysis results
app.get("/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await macroService.getAnalysisHistory(limit);

    res.json({
      success: true,
      count: history.length,
      analyses: history,
    });
  } catch (error) {
    console.error("❌ [API] History request failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve history",
      error: error.message,
    });
  }
});

// Status endpoint - Service health and configuration information
app.get("/status", (req, res) => {
  res.json({
    service: "Macro Economic Indicators Analysis Service",
    status: "operational",
    isRunning: macroService.isRunning,
    configuration: {
      lookbackPeriod: `${CONFIG.LOOKBACK_HOURS} hours (${Math.round(
        CONFIG.LOOKBACK_HOURS / 24
      )} days)`,
      dataCollectionInterval:
        "Hourly aggregated data from 1-minute intervals for S&P 500 and Currency data",
      analysisFrequency: "Every hour at 58 minutes",
      dataServiceUrl: CONFIG.DATA_SERVICE_URL,
    },
    uptime: process.uptime(),
  });
});

/**
 * Automated Analysis Scheduling
 *
 * Sets up a cron job to automatically trigger macro indicators analysis
 * at regular intervals (every hour at 58 minutes past the hour).
 */
console.log(
  `⏰ [CRON] Scheduling macro indicators analysis every hour at 58 minutes`
);
cron.schedule(CONFIG.ANALYSIS_INTERVAL, async () => {
  console.log("⏰ [CRON] Triggered scheduled macro indicators analysis");
  try {
    await macroService.performMacroAnalysis();
  } catch (error) {
    console.error("❌ [CRON] Scheduled analysis failed:", error);
  }
});

/**
 * Server Startup
 *
 * Starts the Express.js web server and logs configuration information
 * for monitoring and debugging purposes.
 */
const server = app.listen(CONFIG.PORT, () => {
  console.log("🚀 [SERVER] Macro Economic Indicators Analysis Service started");
  console.log(`📍 [SERVER] Running on port ${CONFIG.PORT}`);
  console.log(`⏰ [CONFIG] Analysis every hour at 58 minutes`);
  console.log(
    `📊 [CONFIG] Analyzing last ${CONFIG.LOOKBACK_HOURS} hours (${Math.round(
      CONFIG.LOOKBACK_HOURS / 24
    )} days) of hourly-aggregated data`
  );
  console.log(
    `🔧 [CONFIG] Monitoring Fear/Greed, S&P 500, and Currency indicators`
  );
});

/**
 * Graceful Shutdown Handling
 *
 * Handles graceful shutdown of the service when receiving termination signals.
 * Ensures proper cleanup of resources and database connections.
 */

// Handle SIGINT (Ctrl+C) signal
process.on("SIGINT", () => {
  console.log("🛑 [SERVER] Received SIGINT, shutting down gracefully");
  server.close(() => {
    console.log("✅ [SERVER] Server closed");
    process.exit(0);
  });
});

// Handle SIGTERM (termination signal) from process managers
process.on("SIGTERM", () => {
  console.log("🛑 [SERVER] Received SIGTERM, shutting down gracefully");
  server.close(() => {
    console.log("✅ [SERVER] Server closed");
    process.exit(0);
  });
});

// Export service and app for testing and external usage
module.exports = { macroService, app };
