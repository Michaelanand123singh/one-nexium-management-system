# AWS App Runner Deployment Guide (GitHub Source)

This guide explains how to deploy the One Nexium Management System to AWS App Runner using the direct GitHub integration.

## Prerequisites

1.  A GitHub repository containing the codebase.
2.  An AWS Account with permissions to create App Runner services.
3.  A Neon PostgreSQL database (or any reachable PostgreSQL).

## Step 1: Connect GitHub to AWS App Runner

1.  Open the [AWS App Runner Console](https://console.aws.amazon.com/apprunner/).
2.  Click **Create service**.
3.  For **Source**, select **Source code repository**.
4.  If you haven't connected GitHub, click **Add new** and follow the prompts to authorize AWS.
5.  Select your repository and the branch (e.g., `main`).
6.  For **Deployment settings**, select **Automatic** (this ensures all changes pushed to GitHub are deployed automatically).

## Step 2: Configure Build and Runtime

1.  In **Configuration file**, select **Use a configuration file**.
2.  App Runner will look for the `apprunner.yaml` file in your repository. We have already created this for you.
    - **Build command**: `npm install && npx prisma generate && npm run build`
    - **Start command**: `node .next/standalone/server.js`
3.  Click **Next**.

## Step 3: Service Settings and Environment Variables

1.  **Service Name**: `onenexium-management-system` (or your choice).
2.  **Virtual CPU & Memory**: 1 vCPU and 2 GB RAM (minimum recommended for Next.js builds).
3.  **Environment Variables**:
    Add the following variables based on your `.env` requirements:
    - `DATABASE_URL`: Your PostgreSQL connection string.
    - `AUTH_SECRET`: A secure random string.
    - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`: ...
    - `CLOUDINARY_API_KEY`: ...
    - `CLOUDINARY_API_SECRET`: ...
    - `RESEND_API_KEY`: ...
    - `GOOGLE_CLIENT_ID`: ...
    - `GOOGLE_CLIENT_SECRET`: ...
    - `NEXIUM_APP_URL`: The URL of your App Runner service (e.g., `xxx.aws-region.awsapprunner.com`).
    - `NODE_ENV`: `production`

> [!IMPORTANT]
> Make sure `NEXIUM_APP_URL` matches the final URL assigned by AWS for OAuth to work.

## Step 4: Networking and IAM

1.  **Public access**: Enabled.
2.  **Instance role**: If your app needs to talk to other AWS services (like S3), create/assign an IAM role. Otherwise, the default is fine.
3.  Click **Next**, review, and click **Create & Deploy**.

## Step 5: Post-Deployment (Database Migrations)

Since App Runner doesn't automatically run Prisma migrations on every deploy (unless added to the build command), you should run them manually or via a CI/CD script when schema changes occur.

To run migrations manually:
```bash
# Push schema changes to your production DB
npx prisma db push
```

## Troubleshooting

### Build Failures: "Failed to execute 'build' command"
This is common in Next.js projects on App Runner. 

1.  **Environment Variables during Build**: Next.js often requires variables like `DATABASE_URL` even during the build phase (even if all your routes are dynamic). 
    - **Fix**: Go to the App Runner Console -> **Configuration** -> **Environment variables** and ensure all variables from your `.env` are added *before* you trigger a build.
2.  **Memory Limits**: Next.js builds are memory-intensive.
    - **Fix**: In the App Runner Console -> **Configuration** -> **Configure service**, ensure you have selected at least **1 vCPU and 2 GB RAM**. If it still fails, try **2 vCPU and 4 GB RAM**.
3.  **Clean Builds**: We have updated `apprunner.yaml` to use `npm ci` for a cleaner, more reliable installation.

- **Deployment logs**: Check these for specific error messages (e.g., if a package is missing or a type error occurred).
- **Application logs**: Check these for errors that happen *after* the app starts.
