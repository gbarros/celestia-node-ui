# Celestia Blob Poster

A simple frontend application for posting blobs to the Celestia network using a local Celestia light node.

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

## Usage

### Node Information

The application displays information about your Celestia node:
- **Node Address**: The account address of your Celestia node
- **P2P ID**: The peer-to-peer identifier of your node
- **Account Balance**: The current balance of your node in TIA
- **DAS Sampling Stats**: Real-time data availability sampling statistics

### Celestia Namespace Format

Celestia namespaces must follow a specific format:
- Total length: 29 bytes (1 byte version + 28 bytes ID)
- For version 0 (user-specifiable namespaces):
  - The ID must have 18 leading zero bytes
  - The remaining 10 bytes are user-specified
- Reserved namespaces cannot be used for user data

The application handles this format automatically for you when using the plaintext or random namespace options.

### Posting a Blob

1. Choose a namespace input method:
   - **Base64**: Enter a namespace directly in base64 format (must be a valid Celestia namespace)
   - **Plaintext**: Enter a human-readable namespace that will be automatically converted to a valid Celestia namespace
   - **Random**: Generate a random readable namespace (e.g., "blue-cat-123") that is automatically formatted as a valid Celestia namespace

   For each namespace option, the application will display the corresponding hex representation, which matches how namespaces are displayed in the Celestia Explorer.

2. Enter your data in base64 format

3. (Optional) Set a custom gas price (default is 0.002)

4. Click "Submit Blob"

5. Wait for the transaction to be processed

6. The application will display:
   - The height at which your blob was included in the Celestia network
   - The namespace in hex format (as shown in Celestia Explorer)
   - The commitment (hash) of your blob, which can be used to verify or retrieve the blob later

### Data Encryption

The application provides data encryption functionality:

1. Data is encrypted based on your browser session
2. A unique encryption key is generated for your session
3. All data is encrypted before being submitted to the Celestia network
4. Only users with the same session key can decrypt the data
5. This provides an additional layer of privacy for your blob data

### Retrieving a Blob

1. Enter the block height where the blob was included
2. Enter the namespace in hex format
3. Click "Retrieve Blob"
4. The application will display the retrieved blob data in base64 format
5. If the blob was encrypted during submission, it will be automatically decrypted if you have the correct session key

### Transfer TIA

The application allows you to transfer TIA tokens from your node to another address:

1. Enter the recipient's Celestia address
2. Enter the amount to send in TIA
3. (Optional) Adjust the gas parameters
4. Click "Transfer"

### Base64 Encoding Tool

The application includes a simple tool to encode text to base64:

1. Enter your raw text in the "Raw Text" field
2. Click "Encode to Base64"
3. The encoded text will appear in the "Base64 Result" field
4. Click on the encoded text to copy it to your clipboard

## API Details

This application uses the Celestia Node API to interact with the network. The main endpoints used are:

- `blob.Submit`: Submits a blob to the Celestia network
- `blob.Get`: Retrieves a blob from the network
- `state.AccountAddress`: Retrieves the node's account address
- `state.Balance`: Retrieves the node's account balance
- `p2p.Info`: Retrieves the node's P2P information
- `das.SamplingStats`: Retrieves data availability sampling statistics

## Live Streaming

The application supports real-time streaming of DAS sampling statistics, giving you up-to-date information about your node's sampling performance.

## Troubleshooting

- Make sure your Celestia light node is running and accessible at `localhost:26658`
- Ensure that both namespace and data are properly base64 encoded
- Verify that your namespace follows the Celestia namespace format (29 bytes total, with version 0 and 18 leading zero bytes in the ID)
- Avoid using reserved namespaces
- Check the console for detailed error messages if a submission fails

## License

APACHE 2.0