# Black Swan Macro Economic Indicators Analysis Service

[![Node.js](https://img.shields.io/badge/Node.js-18.0.0+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Muhammad%20Bilal%20Motiwala-orange.svg)](https://github.com/bilalmotiwala)

A microservice that provides comprehensive analysis of key macro economic indicators including the Fear & Greed Index, S&P 500 performance, and currency exchange rates. The service automatically collects data, processes it into meaningful metrics, and generates AI-powered insights about current market conditions.

## Features

- **Real-time Data Collection**: Automatically fetches macro economic data from external APIs
- **AI-Powered Analysis**: Uses OpenRouter/GPT to generate comprehensive market insights
- **Automated Scheduling**: Runs analysis every hour at 58 minutes past the hour
- **Historical Tracking**: Stores analysis results in Firestore for trend analysis
- **RESTful API**: Provides endpoints for manual analysis triggers and data retrieval
- **Security**: Implements rate limiting, security headers, and input validation
- **Scalable Architecture**: Built with Express.js and designed for cloud deployment

## Architecture

### Core Components

1. **MacroDataCollector**: Handles data collection from external APIs
2. **MacroAnalysisEngine**: Manages AI-powered analysis using OpenRouter/GPT
3. **MacroStorageManager**: Handles Firestore database operations
4. **MacroIndicatorsService**: Orchestrates the complete analysis workflow

### Data Flow

```
External APIs → Data Collection → Metric Calculation → AI Analysis → Database Storage
     ↓              ↓                    ↓               ↓              ↓
Fear & Greed    Raw Data         Statistical      AI Insights    Historical
S&P 500         Processing       Metrics          Generation     Tracking
Currency Rates  Aggregation      Computation      (GPT-5 Mini)   (Firestore)
```

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Firebase project with Firestore enabled
- OpenRouter API account

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd macro-indicators-service
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Set up Firebase**

   - Create a Firebase project
   - Enable Firestore database
   - Generate a service account key
   - Place the `serviceAccountKey.json` file in the project root

5. **Start the service**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## Configuration

### Environment Variables

| Variable             | Description                        | Required | Default |
| -------------------- | ---------------------------------- | -------- | ------- |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI analysis | Yes      | -       |
| `DATA_SERVICE_URL`   | URL of the external data service   | Yes      | -       |
| `PORT`               | Server port                        | No       | 8084    |

### Service Configuration

The service is configured through the `CONFIG` object in `index.js`:

- **Analysis Interval**: Every hour at 58 minutes (`"58 * * * *"`)
- **Lookback Period**: 168 hours (7 days) of historical data
- **Data Collection**: Hourly aggregation from minute-level data
- **AI Model**: GPT-5 Mini via OpenRouter
- **Database**: Firestore collection `macro_indicators_analysis`

## API Documentation

### Base URL

```
http://localhost:8084
```

### Endpoints

#### 1. Service Information

```http
GET /
```

**Response:**

```json
{
  "service": "Macro Economic Indicators Analysis Service",
  "version": "1.0.0",
  "status": "running",
  "description": "AI-powered analysis of Fear/Greed Index, S&P 500, and Currency Exchange data",
  "endpoints": {
    "/analyze": "POST - Trigger macro indicators analysis",
    "/history": "GET - Get recent analysis history",
    "/status": "GET - Service status and metrics"
  }
}
```

#### 2. Trigger Analysis

```http
POST /analyze
```

**Description:** Manually triggers a macro indicators analysis cycle.

**Response:**

```json
{
  "success": true,
  "message": "Macro indicators analysis completed successfully",
  "result": {
    "analysisId": "firestore-document-id",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "fearGreedValue": 45,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### 3. Analysis History

```http
GET /history?limit=10
```

**Parameters:**

- `limit` (optional): Number of recent analyses to retrieve (default: 10)

**Response:**

```json
{
  "success": true,
  "count": 5,
  "analyses": [
    {
      "id": "document-id",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "analysisTime": "2024-01-15T10:30:00.000Z",
      "analysis": {
        "sp500_analysis": "Current S&P 500 status and trends...",
        "fear_greed_analysis": "Current fear/greed sentiment...",
        "currency_analysis": "Currency market conditions...",
        "analysis_summary": "Overall market summary...",
        "fear_greed_value": 45,
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      "serviceVersion": "1.0.0",
      "model": "openai/gpt-5-mini",
      "provider": "openrouter",
      "dataCollectionPeriod": "168 hours"
    }
  ]
}
```

#### 4. Service Status

```http
GET /status
```

**Response:**

```json
{
  "service": "Macro Economic Indicators Analysis Service",
  "status": "operational",
  "isRunning": false,
  "configuration": {
    "lookbackPeriod": "168 hours (7 days)",
    "dataCollectionInterval": "Hourly aggregated data from 1-minute intervals",
    "analysisFrequency": "Every hour at 58 minutes",
    "dataServiceUrl": "https://your-data-service.com"
  },
  "uptime": 3600
}
```

## Data Sources

### Fear & Greed Index

- **Source**: External data service API
- **Frequency**: Real-time updates
- **Data**: Current index value (0-100) and classification
- **Usage**: Market sentiment analysis

### S&P 500

- **Source**: External data service API
- **Frequency**: Minute-level data aggregated to hourly
- **Data**: Price points over 7-day lookback period
- **Usage**: Stock market performance analysis

### Currency Exchange Rates

- **Source**: External data service API
- **Frequency**: Minute-level data aggregated to hourly
- **Data**: Major currency pairs (USD/EUR, USD/GBP, etc.)
- **Usage**: Currency market stability analysis

## AI Analysis

### Model Configuration

- **Provider**: OpenRouter
- **Model**: GPT-5 Mini
- **Temperature**: 0.3 (for consistent analysis)
- **Max Tokens**: 10,000
- **Timeout**: 60 seconds

### Analysis Output

The AI generates structured analysis including:

1. **S&P 500 Analysis**: Current status, trend direction, and recent performance
2. **Fear & Greed Analysis**: Current sentiment level and market psychology
3. **Currency Analysis**: Exchange rate movements and market stability
4. **Analysis Summary**: Comprehensive market condition overview

### Prompt Engineering

The service uses a sophisticated prompt template system that:

- Formats data into structured sections
- Provides context about the analysis period
- Ensures consistent output format
- Maintains neutrality and objectivity

## Database Schema

### Firestore Collection: `macro_indicators_analysis`

```json
{
  "timestamp": "Firestore Server Timestamp",
  "analysisTime": "2024-01-15T10:30:00.000Z",
  "analysis": {
    "sp500_analysis": "string",
    "fear_greed_analysis": "string",
    "currency_analysis": "string",
    "analysis_summary": "string",
    "fear_greed_value": "number",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "serviceVersion": "1.0.0",
  "model": "openai/gpt-5-mini",
  "provider": "openrouter",
  "dataCollectionPeriod": "168 hours"
}
```

## Monitoring and Logging

### Log Levels

- **✅ Success**: Successful operations
- **📊 Data**: Data collection and processing
- **🧠 Analysis**: AI analysis operations
- **💾 Storage**: Database operations
- **⏰ Cron**: Scheduled task execution
- **❌ Error**: Error conditions

### Health Checks

- Service status endpoint: `GET /status`
- Analysis history endpoint: `GET /history`
- Manual analysis trigger: `POST /analyze`

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security Headers**: Helmet.js for security headers
- **Input Validation**: Request size limits and validation
- **CORS**: Configurable cross-origin resource sharing
- **Environment Variables**: Secure credential management

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8084
CMD ["npm", "start"]
```

### Environment Variables for Production

```bash
PORT=8084
OPENROUTER_API_KEY=your-openrouter-api-key
DATA_SERVICE_URL=https://your-data-service.com
NODE_ENV=production
```

### Process Management

Recommended process managers:

- PM2
- Docker with restart policies
- Kubernetes deployments
- Systemd services

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode with auto-reload
npm run dev

# Run tests (if available)
npm test
```

### Code Structure

```
macro-indicators-service/
├── index.js                 # Main service file
├── prompts/                 # AI prompt templates
│   ├── prompt-config.js     # Prompt management system
│   ├── macro-analysis-v1.md # Analysis prompt template
│   └── README.md           # Prompt documentation
├── serviceAccountKey.json   # Firebase credentials
├── package.json            # Dependencies and scripts
├── .env.example           # Environment variables template
└── README.md              # This documentation
```

## Troubleshooting

### Common Issues

1. **Firebase Connection Errors**

   - Verify `serviceAccountKey.json` is present and valid
   - Check Firebase project configuration
   - Ensure Firestore is enabled

2. **OpenRouter API Errors**

   - Verify `OPENROUTER_API_KEY` is set correctly
   - Check API key permissions and quotas
   - Monitor rate limits

3. **Data Service Connection Issues**

   - Verify `DATA_SERVICE_URL` is accessible
   - Check network connectivity
   - Monitor external service status

4. **Analysis Failures**
   - Check logs for specific error messages
   - Verify data quality and availability
   - Monitor AI model response times

### Debug Mode

Enable detailed logging by setting:

```bash
DEBUG=macro-indicators-service
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add comprehensive comments
5. Test your changes
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Muhammad Bilal Motiwala**

- GitHub: [@bilalmotiwala](https://github.com/bilalmotiwala)
- Email: [bilal@oaiaolabs.com](mailto:bilal@oaiaolabs.com)

## 🆘 Support

For support and questions:

1. Check the API documentation above
2. Review the logs for error messages
3. Verify your environment configuration
4. Ensure all required services are running
