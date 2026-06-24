# Workspace Rules

## Authentication Rules

- **Corporate authentication requirement**: All HQ Admins (Super Admins), as well as ADMIN and VIEWER roles under the Central HQ Workspace, must exclusively authenticate through the "Authentication gateway for Corporate HQ Admins, Supervisors, and read-only Viewer" during login.
- **Routing Contexts**:
  - Target Workspace: Central HQ
  - Covered Roles: HQ Super Admin, Admin, Supervisor, Viewer
  - Enforced Login Route: Corporate HQ Authentication Gateway
