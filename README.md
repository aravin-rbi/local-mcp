# Jira MCP Server

## Overview
This is a Model Context Protocol (MCP) server that provides Jira integration. It connects to Jira using environment variables for configuration and can be used with VS Code and other MCP-compatible clients.

## Setup

### 1. Install Dependencies
```sh
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```env
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-api-token
PROJECT_CODE=TRX
```

**Getting a Jira API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and use it as `JIRA_API_TOKEN`

- `PROJECT_CODE` is a code identifying your project (e.g., TRX). It will be used in server responses and can be customized.

### 3. VS Code Setup

**Important:** MCP support is built into VS Code through GitHub Copilot Chat. No extension installation is required!

1. **Ensure GitHub Copilot is enabled:**
   - MCP servers work with GitHub Copilot Chat in VS Code
   - Make sure you have GitHub Copilot enabled in VS Code

2. **Set Environment Variables:**
   - You can set environment variables in your shell profile (`.zshrc`, `.bashrc`, etc.):
     ```bash
     export JIRA_URL="https://your-domain.atlassian.net"
     export JIRA_USER="your-email@example.com"
     export JIRA_API_TOKEN="your-api-token"
     export PROJECT_CODE="TRX"
     ```
   - Or update the `.vscode/settings.json` file in your project to use hardcoded values (not recommended for tokens)

3. **Configure MCP Server in VS Code:**
   - The MCP server is already configured in `/Users/aravind_appadurai/projects/rbi/.vscode/settings.json`
   - The configuration points to: `/Users/aravind_appadurai/playground/MCP/simple-mcp/index.js`

4. **Restart VS Code** to load the MCP server configuration

#### Option B: Manual VS Code Configuration

If you prefer to configure manually, add this to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/simple-mcp/index.js"],
      "env": {
        "JIRA_URL": "https://your-domain.atlassian.net",
        "JIRA_USER": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token",
        "PROJECT_CODE": "TRX"
      }
    }
  }
}
```

**Note:** Replace `/absolute/path/to/simple-mcp/index.js` with the actual absolute path to your `index.js` file.

### 4. Verify Installation

1. Open VS Code
2. Open the Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Look for MCP-related commands
4. The server should appear in the MCP panel

## Available Tools

The MCP server provides the following tools:

### `test_jira_connection`
Tests the connection to Jira and verifies credentials.

**Example:**
```json
{
  "name": "test_jira_connection",
  "arguments": {}
}
```

### `list_jira_boards`
Lists all Jira boards accessible to the authenticated user.

**Example:**
```json
{
  "name": "list_jira_boards",
  "arguments": {}
}
```

### `list_jira_issues`
Lists Jira issues. Can filter by boardId or JQL query.

**Parameters:**
- `boardId` (optional): Board ID to filter issues
- `jql` (optional): JQL (Jira Query Language) query to filter issues

**Example:**
```json
{
  "name": "list_jira_issues",
  "arguments": {
    "jql": "project = PROJ AND status = 'In Progress'"
  }
}
```

### `get_jira_issue_comments`
Gets all comments for a specific Jira issue.

**Parameters:**
- `issueId` (required): The Jira issue ID or key (e.g., "PROJ-123")

**Example:**
```json
{
  "name": "get_jira_issue_comments",
  "arguments": {
    "issueId": "PROJ-123"
  }
}
```

## Available Resources

### `jira://project-info`
Returns information about the configured Jira project, including project code, Jira URL, and authenticated user.

## Testing the Server

You can test the server directly from the command line:

```sh
npm start
```

The server communicates via stdio (standard input/output) using JSON-RPC, so it's designed to be used by MCP clients, not directly.

## Requirements

- Node.js 18+ (for ES modules support)
- Jira Cloud account with API token
- VS Code with MCP extension (for VS Code usage)

## Troubleshooting

### Server not appearing in VS Code
1. Check that the MCP extension is installed
2. Verify the path in `settings.json` is absolute and correct
3. Check VS Code Developer Console (Help > Toggle Developer Tools) for errors
4. Ensure environment variables are set correctly

### Connection errors
1. Verify your Jira credentials are correct
2. Check that your Jira API token hasn't expired
3. Ensure your Jira URL is correct (should end with `.atlassian.net`)

### Permission errors
1. Make sure the `index.js` file is executable: `chmod +x index.js`
2. Verify Node.js is in your PATH

---

**Note:** Never commit your `.env` file or API tokens to version control. The `.env` file should be in `.gitignore`.

