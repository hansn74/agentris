# End-User Test Scenarios for Stories 1.1 - 1.6

## Overview
This document provides comprehensive end-user test scenarios for validating the completed implementation of Epic 1 (Foundation & Core Infrastructure) stories. These scenarios focus on user-facing functionality and integration points.

## Test Environment Setup

### Prerequisites
1. Node.js v20+ installed
2. pnpm v10.15.1+ installed  
3. Docker v24+ installed and running
4. Git installed
5. Valid Jira account (for integration testing)

### Initial Setup Steps
```bash
# Clone repository
git clone [repository-url]
cd agentris

# Install dependencies
pnpm install

# Start Docker services (PostgreSQL + Redis)
docker-compose -f docker/docker-compose.yml up -d

# Setup database
pnpm db:push

# Start development server
pnpm dev
```

---

## Story 1.1: Project Setup & Monorepo Structure

### Test Scenario 1.1.1: Development Environment Setup
**Objective**: Verify the monorepo setup works correctly for new developers

**Test Steps**:
1. Clone the repository to a fresh directory
2. Run `pnpm install` in the root directory
3. Verify no installation errors occur
4. Run `pnpm build` to build all packages
5. Verify all packages build successfully
6. Run `pnpm test` to execute all tests
7. Verify all tests pass

**Expected Results**:
- Installation completes within 2 minutes
- All packages build without errors
- Test suite executes with passing tests
- No TypeScript compilation errors

### Test Scenario 1.1.2: Docker Services Verification
**Objective**: Validate local development services start correctly

**Test Steps**:
1. Run `docker-compose -f docker/docker-compose.yml up -d`
2. Wait for services to start (30 seconds)
3. Run `docker ps` to verify containers
4. Test PostgreSQL connection: `docker exec agentris-postgres psql -U postgres -c '\l'`
5. Test Redis connection: `docker exec agentris-redis redis-cli ping`

**Expected Results**:
- PostgreSQL container running on port 5432
- Redis container running on port 6379
- Both containers show as "healthy"
- Database connection successful
- Redis responds with "PONG"

### Test Scenario 1.1.3: Development Workflow
**Objective**: Verify hot-reload and development features work

**Test Steps**:
1. Start development server: `pnpm dev`
2. Open browser to http://localhost:3000
3. Modify `apps/web/app/page.tsx` - change text content
4. Save the file
5. Observe browser for automatic reload
6. Check terminal for rebuild messages

**Expected Results**:
- Development server starts on port 3000
- Page loads without errors
- Changes reflect immediately in browser
- No full page refresh needed
- Terminal shows incremental build

---

## Story 1.2: CI/CD Pipeline Setup

### Test Scenario 1.2.1: Local CI Validation
**Objective**: Verify CI checks can be run locally before pushing

**Test Steps**:
1. Run `pnpm lint` to check code style
2. Run `pnpm typecheck` to verify TypeScript
3. Run `pnpm test` to execute tests
4. Create a test branch: `git checkout -b test/ci-validation`
5. Make a small code change
6. Commit with message: `test: validate ci checks`
7. Observe pre-commit hooks execution

**Expected Results**:
- Linting passes or shows clear violations
- TypeScript compilation succeeds
- All tests pass
- Pre-commit hooks run automatically
- Commit is blocked if checks fail

### Test Scenario 1.2.2: GitHub Actions Workflow
**Objective**: Validate CI pipeline triggers correctly

**Test Steps**:
1. Fork the repository to your GitHub account
2. Create a new branch: `test/ci-pipeline`
3. Make a small change to any `.ts` file
4. Push branch and create a Pull Request
5. Navigate to Actions tab in GitHub
6. Monitor CI workflow execution

**Expected Results**:
- CI workflow triggers automatically
- All steps show as green/passing:
  - Checkout code ✓
  - Setup Node.js ✓
  - Install dependencies ✓
  - Run lint ✓
  - Run typecheck ✓
  - Run tests ✓
- PR shows checks passed

### Test Scenario 1.2.3: Docker Build Verification
**Objective**: Verify Docker image builds correctly

**Test Steps**:
1. Run `docker build -t agentris-test .`
2. Wait for build completion
3. Run `docker run -p 3001:3000 agentris-test`
4. Open browser to http://localhost:3001
5. Verify application loads

**Expected Results**:
- Docker build completes successfully
- Image size is reasonable (<500MB)
- Container starts without errors
- Application accessible on port 3001
- Health check endpoint responds

---

## Story 1.3: Core Authentication Service

### Test Scenario 1.3.1: User Registration
**Objective**: Verify new users can register successfully

**Test Steps**:
1. Navigate to http://localhost:3000/login
2. Click "Sign up" or "Register" link
3. Fill in registration form:
   - Email: testuser@example.com
   - Password: SecurePass123!
   - Name: Test User
4. Submit the form
5. Check for success message
6. Verify redirect to dashboard or login

**Expected Results**:
- Registration form validates input
- Password requirements shown clearly
- Success message displayed
- User account created in database
- Can log in with new credentials

### Test Scenario 1.3.2: User Login/Logout Flow
**Objective**: Test complete authentication cycle

**Test Steps**:
1. Navigate to http://localhost:3000/login
2. Enter credentials:
   - Email: testuser@example.com
   - Password: SecurePass123!
3. Click "Sign In"
4. Verify redirect to dashboard
5. Check user name displayed in header
6. Click logout button
7. Verify redirect to login page

**Expected Results**:
- Login succeeds with valid credentials
- Dashboard shows authenticated content
- User session persists on page refresh
- Logout clears session completely
- Protected routes redirect to login

### Test Scenario 1.3.3: Password Reset Flow
**Objective**: Verify password reset functionality

**Test Steps**:
1. Navigate to login page
2. Click "Forgot Password?" link
3. Enter email: testuser@example.com
4. Submit reset request
5. Check console logs for reset token (MVP uses console)
6. Navigate to reset URL with token
7. Enter new password: NewSecure456!
8. Submit password change
9. Login with new password

**Expected Results**:
- Reset request acknowledged
- Console shows reset email details
- Reset link works correctly
- Password successfully changed
- Old password no longer works
- New password allows login

### Test Scenario 1.3.4: Role-Based Access Control
**Objective**: Verify different user roles have appropriate access

**Test Steps**:
1. Create users with different roles (via database or API):
   - consultant@test.com (CONSULTANT role)
   - manager@test.com (MANAGER role)
   - admin@test.com (ADMIN role)
2. Login as consultant
3. Verify basic dashboard access
4. Attempt to access admin settings (should fail)
5. Logout and login as admin
6. Verify full access to all sections

**Expected Results**:
- Each role sees appropriate menu items
- Unauthorized access shows error
- Admin has full system access
- Manager has team-level access
- Consultant has personal access only

---

## Story 1.4: API Layer Implementation

### Test Scenario 1.4.1: API Health Check
**Objective**: Verify API layer is operational

**Test Steps**:
1. Start the application: `pnpm dev`
2. Open browser to http://localhost:3000/api/health
3. Verify JSON response
4. Check response contains:
   - status: "healthy"
   - uptime: number
   - timestamp: ISO date
   - database: "connected"

**Expected Results**:
- Health endpoint responds with 200 OK
- JSON structure is valid
- All services report healthy
- Response time < 500ms

### Test Scenario 1.4.2: Rate Limiting Verification
**Objective**: Test API rate limiting functionality

**Test Steps**:
1. Login as a test user
2. Open browser developer tools (Network tab)
3. Rapidly click refresh on tickets page (10+ times)
4. Monitor network responses
5. Look for 429 (Too Many Requests) responses
6. Wait 60 seconds
7. Try again - should work

**Expected Results**:
- Initial requests succeed
- After threshold, 429 responses appear
- Rate limit headers visible:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
- Recovery after cooldown period

### Test Scenario 1.4.3: API Error Handling
**Objective**: Verify graceful error handling

**Test Steps**:
1. Stop database: `docker-compose stop postgres`
2. Try to login
3. Observe error message
4. Restart database: `docker-compose start postgres`
5. Wait 30 seconds
6. Try login again

**Expected Results**:
- Clear error message shown to user
- No sensitive information exposed
- Application doesn't crash
- Recovery works after service restored
- Errors logged appropriately

---

## Story 1.5: Jira Integration Service

### Test Scenario 1.5.1: Jira OAuth Connection
**Objective**: Connect user account to Jira

**Test Steps**:
1. Login to the application
2. Navigate to Settings → Integrations
3. Click "Connect to Jira" button
4. Verify redirect to Jira authorization
5. Login to Jira (if needed)
6. Approve application access
7. Verify redirect back to application
8. Check connection status shows "Connected"

**Expected Results**:
- Smooth OAuth flow
- Clear permission request from Jira
- Successful redirect after authorization
- Connection status updates
- User's Jira instance URL displayed

### Test Scenario 1.5.2: Fetching Jira Tickets
**Objective**: Verify ticket synchronization works

**Test Steps**:
1. Ensure Jira is connected (previous test)
2. Navigate to Tickets page
3. Click "Sync Tickets" or wait for auto-sync
4. Observe loading state
5. Verify tickets appear in list
6. Check ticket details match Jira:
   - Ticket key (e.g., PROJ-123)
   - Summary/Title
   - Status
   - Assignee

**Expected Results**:
- Loading indicator shown during sync
- Tickets load within 5 seconds
- All assigned tickets visible
- Accurate ticket information
- Proper error if no tickets found

### Test Scenario 1.5.3: Viewing Ticket Details
**Objective**: Verify detailed ticket information display

**Test Steps**:
1. From tickets list, click on a ticket
2. Verify detail page loads
3. Check displayed information:
   - Full description
   - Acceptance criteria
   - Comments history
   - Current status
   - Priority and type
4. Verify markdown formatting works
5. Check back navigation to list

**Expected Results**:
- Detail page loads quickly
- All ticket fields populated
- Markdown renders correctly
- Comments in chronological order
- Navigation works smoothly

### Test Scenario 1.5.4: Webhook Updates
**Objective**: Test real-time ticket updates

**Test Steps**:
1. Open ticket detail page in app
2. In Jira, update the same ticket:
   - Change status
   - Add a comment
3. Wait up to 30 seconds
4. Observe if app updates automatically
5. If not automatic, refresh page
6. Verify changes reflected

**Expected Results**:
- Webhook triggers update (if configured)
- Or manual refresh shows changes
- Status change reflected
- New comment visible
- No data inconsistencies

---

## Story 1.6: Basic Web UI Shell

### Test Scenario 1.6.1: Responsive Design - Desktop
**Objective**: Verify UI works on desktop screens

**Test Steps**:
1. Open application in desktop browser
2. Set viewport to 1920x1080
3. Navigate through all pages:
   - Login
   - Dashboard
   - Tickets list
   - Ticket detail
   - Settings
4. Resize to 1440px width
5. Resize to 1024px width
6. Verify layout adapts properly

**Expected Results**:
- Sidebar visible and functional
- Content properly centered
- No horizontal scrolling
- All interactive elements accessible
- Text remains readable

### Test Scenario 1.6.2: Responsive Design - Tablet
**Objective**: Verify UI works on tablet screens

**Test Steps**:
1. Open browser developer tools
2. Enable device emulation
3. Select iPad (768px width)
4. Navigate through all pages
5. Test sidebar collapse/expand
6. Verify touch targets are adequate
7. Test form inputs and buttons

**Expected Results**:
- Sidebar collapses to hamburger menu
- Content fills available space
- Touch targets ≥ 44px
- Forms remain usable
- No overlapping elements

### Test Scenario 1.6.3: Loading States
**Objective**: Verify proper loading indicators

**Test Steps**:
1. Enable network throttling (Slow 3G)
2. Navigate to tickets page
3. Observe loading skeleton
4. Wait for data to load
5. Navigate to ticket detail
6. Observe detail loading state
7. Test other data-fetching pages

**Expected Results**:
- Skeleton screens show immediately
- Loading indicators are clear
- No layout shift when data loads
- Error states for timeouts
- Retry options available

### Test Scenario 1.6.4: Error Boundaries
**Objective**: Test error handling in UI

**Test Steps**:
1. Disconnect from network
2. Try to navigate to tickets
3. Observe error message
4. Reconnect network
5. Click retry button
6. Verify recovery

**Expected Results**:
- Friendly error messages
- No white screen of death
- Clear retry actions
- Graceful degradation
- Error boundaries contain failures

### Test Scenario 1.6.5: Accessibility
**Objective**: Verify basic accessibility features

**Test Steps**:
1. Navigate using only keyboard (Tab key)
2. Verify focus indicators visible
3. Test form submission with Enter key
4. Use screen reader (if available)
5. Check color contrast
6. Verify ARIA labels present

**Expected Results**:
- All interactive elements reachable
- Clear focus indicators
- Keyboard shortcuts work
- Screen reader announces properly
- Sufficient color contrast
- Proper heading hierarchy

---

## Integration Test Scenarios

### Integration Test 1: Complete User Journey
**Objective**: Test end-to-end user workflow

**Test Steps**:
1. Register new account
2. Login with new credentials
3. Connect Jira account
4. Sync and view tickets
5. View ticket details
6. Disconnect Jira
7. Logout

**Expected Results**:
- Each step completes successfully
- Data persists between steps
- No errors in console
- Smooth user experience

### Integration Test 2: Multi-User Scenario
**Objective**: Verify system handles multiple users

**Test Steps**:
1. Create 3 test users
2. Login with User 1, connect Jira
3. Login with User 2, connect different Jira
4. Login with User 3, no Jira connection
5. Verify each user sees only their data
6. Test concurrent access

**Expected Results**:
- User data properly isolated
- No data leakage between users
- Concurrent access works
- Individual rate limits applied

### Integration Test 3: System Recovery
**Objective**: Test system resilience

**Test Steps**:
1. Login and navigate to dashboard
2. Stop Redis: `docker-compose stop redis`
3. Try to perform actions
4. Start Redis: `docker-compose start redis`
5. Verify system recovers
6. Repeat with PostgreSQL

**Expected Results**:
- Graceful degradation
- Clear error messages
- Automatic recovery
- No data corruption
- Sessions persist (where possible)

---

## Performance Test Scenarios

### Performance Test 1: Page Load Times
**Objective**: Verify acceptable performance

**Test Criteria**:
- Initial page load: < 3 seconds
- Subsequent navigation: < 1 second
- API responses: < 500ms
- Time to interactive: < 5 seconds

### Performance Test 2: Concurrent Users
**Objective**: Test with multiple simultaneous users

**Test Steps**:
1. Simulate 10 concurrent users
2. Each user logs in and fetches tickets
3. Monitor response times
4. Check for errors

**Expected Results**:
- System remains responsive
- No timeout errors
- Rate limiting works correctly
- Database connections managed

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Environment variables configured
- [ ] Docker services running
- [ ] Database migrated
- [ ] Test data prepared
- [ ] Jira test account ready

### Story 1.1 Tests
- [ ] Development environment setup
- [ ] Docker services verification
- [ ] Development workflow

### Story 1.2 Tests
- [ ] Local CI validation
- [ ] GitHub Actions workflow
- [ ] Docker build verification

### Story 1.3 Tests
- [ ] User registration
- [ ] Login/logout flow
- [ ] Password reset
- [ ] Role-based access

### Story 1.4 Tests
- [ ] API health check
- [ ] Rate limiting
- [ ] Error handling

### Story 1.5 Tests
- [ ] Jira OAuth connection
- [ ] Fetching tickets
- [ ] Viewing details
- [ ] Webhook updates

### Story 1.6 Tests
- [ ] Desktop responsive
- [ ] Tablet responsive
- [ ] Loading states
- [ ] Error boundaries
- [ ] Accessibility

### Integration Tests
- [ ] Complete user journey
- [ ] Multi-user scenario
- [ ] System recovery

### Performance Tests
- [ ] Page load times
- [ ] Concurrent users

---

## Bug Reporting Template

When issues are found, report with:

**Bug ID**: [EPIC-1-XXX]
**Story**: [1.X]
**Test Scenario**: [X.X.X]
**Severity**: [Critical/High/Medium/Low]

**Description**:
[Clear description of the issue]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Environment**:
- OS: [e.g., macOS 13.5]
- Browser: [e.g., Chrome 120]
- Node Version: [e.g., v20.11.0]

**Screenshots/Logs**:
[Attach if applicable]

---

## Test Completion Criteria

The implementation is considered ready when:

1. **Functional Coverage**: All test scenarios pass
2. **Error Handling**: No unhandled errors in any scenario
3. **Performance**: Meets performance criteria
4. **Security**: Authentication and authorization work correctly
5. **Accessibility**: Basic accessibility requirements met
6. **Documentation**: All setup steps documented and working

## Notes for Testers

1. **Environment Isolation**: Use separate database for testing
2. **Test Data**: Create fresh test data for each session
3. **Browser Testing**: Test in Chrome, Firefox, and Safari
4. **Console Monitoring**: Keep browser console open for errors
5. **Network Conditions**: Test with various network speeds
6. **Session Management**: Test with multiple browser tabs
7. **Cache Behavior**: Test with and without cache

## Contact Information

For questions or issues during testing:
- Technical Lead: [Contact]
- QA Lead: Quinn (Test Architect)
- Documentation: See /docs folder
- Issue Tracking: GitHub Issues

---

*Document Version: 1.0*
*Last Updated: 2025-09-10*
*Epic: 1 - Foundation & Core Infrastructure*