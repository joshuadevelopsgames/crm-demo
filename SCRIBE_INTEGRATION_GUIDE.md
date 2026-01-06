# Integrating Scribe Guides into Tutorials

This guide explains how to use the Scribe Chrome extension to create interactive step-by-step guides and integrate them into your tutorial section.

## What is Scribe?

Scribe is a Chrome extension that automatically creates step-by-step guides by recording your actions. It captures screenshots and generates visual instructions that can be embedded into web pages.

## Step 1: Install Scribe Chrome Extension

1. Go to [Scribe Chrome Extension page](https://get.scribehow.com/install-extension/)
2. Click "Add to Chrome" to install
3. Pin the Scribe icon to your Chrome toolbar for easy access

## Step 2: Create a Scribe Guide

1. **Start Recording:**
   - Click the Scribe icon in your Chrome toolbar
   - Select "Start Capture" to begin recording
   - Navigate to the page/feature you want to document
   - Perform the steps you want to teach (click buttons, fill forms, etc.)
   - Scribe will automatically capture screenshots and actions

2. **Complete the Capture:**
   - Click "Complete Capture" when finished
   - Scribe will open a new tab with your guide

3. **Edit and Customize:**
   - Review the automatically generated steps
   - Edit text, add annotations, or remove unnecessary steps
   - Add additional notes or clarifications

## Step 3: Get the Embed URL

1. In the Scribe editor, click the **"Share"** button
2. Choose the **"Embed"** option
3. Copy the embed URL (it will look like: `https://scribehow.com/embed/...`)

Alternatively, you can use the share link and the component will automatically convert it to an embed URL.

## Step 4: Add to Tutorial Step

Add the Scribe URL to any tutorial step in `src/pages/Tutorial.jsx`:

```javascript
{
  id: 'example-step',
  title: 'Example Tutorial Step',
  description: 'Learn how to use this feature',
  content: (
    <div className="space-y-4">
      <p>This step includes an interactive Scribe guide below.</p>
    </div>
  ),
  // Add Scribe integration here:
  scribeUrl: 'https://scribehow.com/embed/your-guide-id',
  scribeTitle: 'Optional: Custom Title for the Embed',
  scribeDescription: 'Optional: Description of what the guide covers',
  scribeHeight: '700px', // Optional: Custom height (default: '600px')
  action: {
    label: 'Try It Yourself',
    route: '/feature-page'
  }
}
```

## Example: Complete Tutorial Step with Scribe

Here's a complete example showing how to integrate a Scribe guide:

```javascript
{
  id: 'accounts-tutorial',
  title: 'How to Create an Account',
  description: 'Step-by-step guide to creating a new account',
  content: (
    <div className="space-y-4">
      <p>Follow the interactive guide below to learn how to create a new account in the CRM.</p>
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>💡 Tip:</strong> The guide below shows you exactly where to click and what to fill in.
        </p>
      </div>
    </div>
  ),
  scribeUrl: 'https://scribehow.com/embed/How-to-Create-an-Account-in-LECRM_abc123',
  scribeTitle: 'Creating a New Account - Interactive Guide',
  scribeDescription: 'Watch and follow along as we create a new account step-by-step',
  action: {
    label: 'Go to Accounts Page',
    route: '/accounts'
  }
}
```

## Component Features

The `ScribeEmbed` component automatically:

- ✅ Converts Scribe share URLs to embed URLs
- ✅ Shows a loading state while the guide loads
- ✅ Handles errors gracefully with a fallback option
- ✅ Provides a button to open the full guide in a new tab
- ✅ Supports custom titles, descriptions, and heights
- ✅ Works with dark mode

## Tips for Creating Great Scribe Guides

1. **Keep it focused:** Create separate guides for different features or workflows
2. **Add context:** Use the description field to explain what the guide covers
3. **Test the flow:** Make sure your recorded steps are clear and easy to follow
4. **Edit carefully:** Remove any unnecessary steps or add annotations for clarity
5. **Use meaningful titles:** Help users understand what they'll learn

## Troubleshooting

### Guide doesn't load
- Verify the Scribe URL is correct
- Make sure the guide is set to "Public" or "Anyone with link can view" in Scribe
- Try opening the URL directly in a new tab to verify it works

### Embed URL format
- The component automatically converts share URLs (`/shared/`) to embed URLs (`/embed/`)
- If you have issues, manually use the embed URL from Scribe's share options

### Height issues
- Adjust the `scribeHeight` property if the guide is cut off or too small
- Default height is `600px`, but you can set it to any CSS height value (e.g., `'800px'`, `'50vh'`)

## Next Steps

1. Create Scribe guides for your most important workflows
2. Add them to relevant tutorial steps
3. Test the integration to ensure guides load properly
4. Gather user feedback on which guides are most helpful

