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

// Environments & Bookings
export const ENVIRONMENTS_QUERY = gql`
  query Environments {
    environments { id name isFreeNow freeAt }
  }
`;

export const ACTIVE_BOOKING_ME_QUERY = gql`
  query ActiveBookingMe {
    activeBookingMe {
      id
      envId
      userId
      status
      createdAt
      justification
      startedAt
      endsAt
      releasedAt
      closedReason
      durationMinutes
      extensionMinutesTotal
    }
  }
`;

export const BOOKINGS_ME_QUERY = gql`
  query BookingsMe {
    bookingsMe {
      id
      envId
      userId
      status
      createdAt
      justification
      startedAt
      endsAt
      releasedAt
      closedReason
      durationMinutes
      extensionMinutesTotal
    }
  }
`;

export const BOOKINGS_ALL_QUERY = gql`
  query BookingsAll {
    bookingsAll {
      id
      envId
      userId
      status
      createdAt
      justification
      startedAt
      endsAt
      releasedAt
      closedReason
      durationMinutes
      extensionMinutesTotal
    }
  }
`;

export const CREATE_ENVIRONMENT_BOOKING = gql`
  mutation CreateEnvironmentBooking($envId: ID!, $durationMinutes: Int!, $justification: String!) {
    createEnvironmentBooking(envId: $envId, durationMinutes: $durationMinutes, justification: $justification) {
      id
      envId
      userId
      status
      createdAt
      justification
      startedAt
      endsAt
      durationMinutes
      extensionMinutesTotal
    }
  }
`;

export const EXTEND_ENVIRONMENT_BOOKING = gql`
  mutation ExtendEnvironmentBooking($bookingId: ID!, $addMinutes: Int!) {
    extendEnvironmentBooking(bookingId: $bookingId, addMinutes: $addMinutes) {
      id
      envId
      endsAt
      extensionMinutesTotal
      status
    }
  }
`;

export const RELEASE_ENVIRONMENT_BOOKING = gql`
  mutation ReleaseEnvironmentBooking($bookingId: ID!) {
    releaseEnvironmentBooking(bookingId: $bookingId) {
      id
      envId
      status
      releasedAt
      endsAt
      closedReason
    }
  }
`;

export const BRANCH_REFS_QUERY = gql`
  query BranchRefs($projectKey: String) {
    branchRefs(projectKey: $projectKey)
  }
`;

export const ADMIN_PENDING_REQUESTS_QUERY = gql`
  query AdminPendingRequests {
    adminPendingRequests {
      requesterName
      requesterEmail
      request {
        id
        userId
        resourceId
        resourceType
        status
        justification
        createdAt
        durationHours
      }
    }
  }
`;

export const ADMIN_ALL_REQUESTS_QUERY = gql`
  query AdminAllRequests {
    adminAllRequests {
      requesterName
      requesterEmail
      request {
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
  }
`;

export const DECIDE_REQUEST_MUTATION = gql`
  mutation DecideRequest($input: DecideRequestInput!) {
    decideRequest(input: $input) {
      id
      status
      approverId
      approverName
      approvedAt
      expiresAt
      decisionNote
    }
  }
`;

export const UPDATE_ME_NAME = gql`
  mutation UpdateMeName($name: String!) {
    updateMeName(name: $name) { id name email role accessLevel }
  }
`;