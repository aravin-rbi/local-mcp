#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import axios from 'axios';

// Load .env file from the script's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

const JIRA_URL = process.env.JIRA_URL;
const JIRA_USER = process.env.JIRA_USER;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_CODE = process.env.PROJECT_CODE || 'UNKNOWN';

// Helper function to make authenticated Jira API requests
async function jiraRequest(endpoint, params = {}) {
  if (!JIRA_URL || !JIRA_USER || !JIRA_API_TOKEN) {
    throw new Error('Missing Jira environment variables. Please set JIRA_URL, JIRA_USER, and JIRA_API_TOKEN.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${JIRA_URL}${endpoint}`;
  try {
    const response = await axios.get(url, {
      auth: {
        username: JIRA_USER,
        password: JIRA_API_TOKEN,
      },
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Jira API error (${error.response.status}): ${error.response.data?.errorMessages?.join(', ') || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('No response from Jira API. Please check your network connection and JIRA_URL.');
    } else {
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value) {
        parsed[key] = value;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[++i];
      } else {
        parsed[key] = true; // Flag without value
      }
    }
  }
  
  return parsed;
}

// CLI command handlers
async function handleCommand(command, args) {
  try {
    switch (command) {
      case 'get-ticket': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const issue = await jiraRequest(`/rest/api/3/issue/${ticket}`);
        return {
          success: true,
          ticket: {
            key: issue.key,
            summary: issue.fields.summary,
            description: issue.fields.description,
            status: issue.fields.status.name,
            priority: issue.fields.priority?.name,
            assignee: issue.fields.assignee?.displayName,
            reporter: issue.fields.reporter?.displayName,
            created: issue.fields.created,
            updated: issue.fields.updated,
            labels: issue.fields.labels,
            components: issue.fields.components?.map(c => c.name),
          }
        };
      }

      case 'get-details': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const issue = await jiraRequest(`/rest/api/3/issue/${ticket}?expand=changelog,renderedFields`);
        const comments = await jiraRequest(`/rest/api/3/issue/${ticket}/comment`);
        
        return {
          success: true,
          ticket: {
            key: issue.key,
            summary: issue.fields.summary,
            description: issue.fields.description,
            status: issue.fields.status.name,
            priority: issue.fields.priority?.name,
            assignee: issue.fields.assignee?.displayName,
            reporter: issue.fields.reporter?.displayName,
            created: issue.fields.created,
            updated: issue.fields.updated,
            labels: issue.fields.labels,
            components: issue.fields.components?.map(c => c.name),
            requirements: extractRequirements(issue.fields.description),
            acceptance_criteria: extractAcceptanceCriteria(issue.fields.description),
            comments: comments.comments?.map(c => ({
              author: c.author.displayName,
              created: c.created,
              body: typeof c.body === 'string' ? c.body : adfToPlainText(c.body)
            })) || []
          }
        };
      }

      case 'get-linked': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const issue = await jiraRequest(`/rest/api/3/issue/${ticket}`);
        const linkedIssues = issue.fields.issuelinks || [];
        
        return {
          success: true,
          linked_tickets: linkedIssues.map(link => ({
            key: link.outwardIssue?.key || link.inwardIssue?.key,
            summary: link.outwardIssue?.fields?.summary || link.inwardIssue?.fields?.summary,
            status: link.outwardIssue?.fields?.status?.name || link.inwardIssue?.fields?.status?.name,
            relation: link.type.name
          }))
        };
      }

      case 'get-comments': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const comments = await jiraRequest(`/rest/api/3/issue/${ticket}/comment`);
        return {
          success: true,
          comments: comments.comments?.map(c => ({
            id: c.id,
            author: c.author.displayName,
            created: c.created,
            body: typeof c.body === 'string' ? c.body : adfToPlainText(c.body)
          })) || []
        };
      }

      case 'get-attachments': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const issue = await jiraRequest(`/rest/api/3/issue/${ticket}`);
        const attachments = issue.fields.attachment || [];
        
        return {
          success: true,
          attachments: attachments.map(a => ({
            id: a.id,
            filename: a.filename,
            size: a.size,
            created: a.created,
            author: a.author.displayName
          }))
        };
      }

      case 'get-epic': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const issue = await jiraRequest(`/rest/api/3/issue/${ticket}`);
        const epicLink = issue.fields.customfield_10014 || issue.fields.parent;
        
        if (epicLink) {
          const epic = await jiraRequest(`/rest/api/3/issue/${epicLink.key || epicLink}`);
          return {
            success: true,
            epic: {
              key: epic.key,
              summary: epic.fields.summary,
              status: epic.fields.status.name
            }
          };
        }
        
        return {
          success: true,
          epic: null
        };
      }

      case 'get-sprint': {
        const { ticket } = args;
        if (!ticket) {
          throw new Error('ticket parameter is required');
        }
        
        const issue = await jiraRequest(`/rest/api/3/issue/${ticket}`);
        const sprint = issue.fields.customfield_10020?.[0]; // Common sprint field
        
        return {
          success: true,
          sprint: sprint ? {
            id: sprint.id,
            name: sprint.name,
            state: sprint.state
          } : null
        };
      }

      case 'test-connection': {
        const userInfo = await jiraRequest('/rest/api/3/myself');
        return {
          success: true,
          projectCode: PROJECT_CODE,
          jiraUser: userInfo,
        };
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to convert ADF (Atlassian Document Format) to plain text
function adfToPlainText(adf) {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  if (typeof adf !== 'object') return String(adf);
  
  const lines = [];
  
  function extractText(node, isListItem = false) {
    if (!node) return '';
    
    if (typeof node === 'string') return node;
    
    if (Array.isArray(node)) {
      return node.map(n => extractText(n, isListItem)).join('');
    }
    
    if (node.type === 'text' && node.text) {
      return node.text;
    }
    
    if (node.type === 'hardBreak') {
      return '\n';
    }
    
    if (node.type === 'paragraph') {
      const text = node.content ? extractText(node.content) : '';
      return text ? text + '\n' : '';
    }
    
    if (node.type === 'heading') {
      const text = node.content ? extractText(node.content) : '';
      return text ? text + '\n' : '';
    }
    
    if (node.type === 'listItem') {
      const text = node.content ? extractText(node.content, true) : '';
      return text ? '- ' + text.trim() + '\n' : '';
    }
    
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return node.content ? extractText(node.content) : '';
    }
    
    if (node.content) {
      return extractText(node.content, isListItem);
    }
    
    return '';
  }
  
  if (adf.content) {
    const text = extractText(adf.content);
    // Clean up multiple consecutive newlines but preserve paragraph structure
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }
  
  return '';
}

// Helper functions to extract requirements and acceptance criteria from description
function extractRequirements(description) {
  if (!description) return [];
  
  // Convert ADF to plain text if needed
  const textDescription = typeof description === 'string' 
    ? description 
    : adfToPlainText(description);
  
  if (!textDescription) return [];
  
  const requirementsMatch = textDescription.match(/Requirements?:?\s*(.*?)(?=\n\n|Acceptance|$)/is);
  if (requirementsMatch) {
    return requirementsMatch[1]
      .split(/\n/)
      .map(req => req.replace(/^[*\-\d.]\s*/, '').trim())
      .filter(req => req.length > 0);
  }
  return [];
}

function extractAcceptanceCriteria(description) {
  if (!description) return [];
  
  // Convert ADF to plain text if needed
  const textDescription = typeof description === 'string' 
    ? description 
    : adfToPlainText(description);
  
  if (!textDescription) return [];
  
  const criteriaMatch = textDescription.match(/Acceptance Criteria:?\s*(.*?)(?=\n\n|Requirements|$)/is);
  if (criteriaMatch) {
    return criteriaMatch[1]
      .split(/\n/)
      .map(criteria => criteria.replace(/^[*\-\d.]\s*/, '').trim())
      .filter(criteria => criteria.length > 0);
  }
  return [];
}

// Main CLI function
async function main() {
  const args = parseArgs();
  const command = args.command;
  
  if (!command) {
    console.error('Usage: node index.js --command=<command> [options]');
    console.error('Available commands: get-ticket, get-details, get-linked, get-comments, get-attachments, get-epic, get-sprint, test-connection');
    process.exit(1);
  }
  
  try {
    const result = await handleCommand(command, args);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
