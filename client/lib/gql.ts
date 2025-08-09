import { gql } from '@apollo/client';

export const RESOURCES_QUERY = gql`
  query Resources {
    resources { id name type riskLevel approverRole tags }
  }
`;

export const MY_REQUESTS_QUERY = gql`
  query MyRequests {
    myRequests {
      id
      userId
      resourceId
      resourceType
      status
      justification
      createdAt
      durationHours
      approvedAt
      expiresAt
      approverId
      approverName
      decisionNote
    }
  }
`;

export const METRICS_ME_QUERY = gql`
  query MetricsMe {
    metricsMe { activeAccesses pending expiring7d activeDeploymentLocks }
  }
`;

export const CREATE_REQUEST_MUTATION = gql`
  mutation CreateRequest($input: CreateRequestInput!) {
    createRequest(input: $input) {
      id
      userId
      resourceId
      resourceType
      status
      justification
      createdAt
      durationHours
      approvedAt
      expiresAt
      approverId
      approverName
      decisionNote
    }
  }
`; 