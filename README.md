# Mammoth Control Panel

A frontend application for interacting with the Celestia network using a local Celestia light node.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A running Celestia light node

## Setup

1. Make sure your Celestia light node is running with the following command:

```bash
celestia light start --p2p.network mocha --core.ip rpc-mocha.pops.one --core.port 9090 --rpc.skip-auth
```

2. Install the dependencies:

```bash
npm install
# or
yarn install
```

3. Start the development server:

```bash
npm start
# or
yarn start
```

4. Open your browser and navigate to `http://localhost:1234`

## Features

The application is organized into four main tabs:

### 1. Node Information

The Node Info tab displays information about your Celestia node:
- **Connection Status**: Shows if you are connected to your Celestia node via WebSocket
- **Node Address**: The account address of your Celestia node
- **P2P ID**: The peer-to-peer identifier of your node
- **Account Balance**: The current balance of your node in TIA

It also provides a transfer function to send TIA tokens from your node to other addresses:
1. Enter the recipient's Celestia address
2. Enter the amount to send in TIA
3. (Optional) Adjust the gas adjustment parameter (default is 1.3)
4. Click "Send TIA"

### 2. Sampling Stats

This tab shows detailed Data Availability Sampling (DAS) statistics for your node:
- **Sync Progress**: Visual representation of your node's synchronization status
- **Catch-up Status**: Shows if your node is caught up with the network
- **Chain Heights**: Head of sampled chain, head of catchup, and network head height
- **Workers**: Detailed information about your node's sampling workers

Features:
- **Live Updates**: Toggle real-time streaming of sampling statistics
- **Manual Refresh**: Refresh the statistics on demand

### 3. Blob Poster

This tab allows you to post data blobs to the Celestia network:

#### Posting a Blob

1. Choose a namespace input method:
   - **Base64**: Enter a namespace directly in base64 format (must be a valid Celestia namespace)
   - **Plaintext**: Enter a human-readable namespace that will be automatically converted to a valid Celestia namespace
   - **Random**: Generate a random readable namespace that is automatically formatted as a valid Celestia namespace

2. Enter your data in base64 format

3. (Optional) Set a custom gas price (default is 0.002)

4. Click "Submit Blob"

5. The application will display:
   - The height at which your blob was included in the Celestia network
   - The namespace in hex and base64 formats

#### Retrieving a Blob

1. Enter the block height where the blob was included
2. Enter the namespace in hex format
3. Click "Retrieve Blob"
4. The application will display the retrieved blob data including:
   - Commitment
   - Namespace
   - Data in base64 format
   - CLI and curl commands to retrieve the same blob

#### Base64 Encoding Tools

The application includes a simple tool to encode text to base64:
1. Enter your raw text in the "Raw Text" field
2. The encoded text will appear in the "Base64 Result" field
3. Click on either text box to copy its contents

### 4. Private Database Rollup

This tab provides functionality to create and manage a database-like structure on top of Celestia:

1. **Initialize Database**:
   - Set a unique namespace for your database
   - Define your database schema in JSON format
   - All data is encrypted by default for privacy

2. **Add Records**:
   - Add new records according to your schema
   - Records are automatically encrypted before being submitted to the network
   - **Schema Validation**: Records are validated against your defined schema
     - Rejects records with missing required fields
     - Prevents adding fields not defined in the schema
     - Ensures data types match the schema definition

3. **View Records**:
   - Browse all records in your database
   - Data is automatically decrypted when retrieved
   - Records show height, timestamp, and content

## Celestia Namespace Format

Celestia namespaces must follow a specific format:
- Total length: 29 bytes (1 byte version + 28 bytes ID)
- For version 0 (user-specifiable namespaces):
  - The ID must have 18 leading zero bytes
  - The remaining 10 bytes are user-specified
- Reserved namespaces cannot be used for user data

The application handles this format automatically when using the plaintext or random namespace options.

## Connection Handling

The application includes robust connection handling:
- Automatically attempts to connect to the Celestia node at startup
- Provides clear connection status indicators
- Shows informative error messages when the node is unavailable
- Times out gracefully when connection attempts fail
- Automatically retries connection when possible

## API Details

This application uses the Celestia Node API over WebSocket to interact with the network. The main endpoints used are:

- `blob.Submit`: Submits a blob to the Celestia network
- `blob.Get`: Retrieves a blob from the network
- `state.AccountAddress`: Retrieves the node's account address
- `state.Balance`: Retrieves the node's account balance
- `p2p.Info`: Retrieves the node's P2P information
- `das.SamplingStats`: Retrieves data availability sampling statistics

## Troubleshooting

- Make sure your Celestia light node is running and accessible at `localhost:26658`
- If you see connection errors, verify that your Celestia node is running
- Ensure that both namespace and data are properly base64 encoded
- Verify that your namespace follows the Celestia namespace format
- Avoid using reserved namespaces
- Check the console for detailed error messages if a submission fails

## License

APACHE 2.0