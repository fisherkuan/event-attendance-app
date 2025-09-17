# Facebook SSO Integration Guide

This document outlines the steps needed to implement Facebook Single Sign-On (SSO) integration for the Event Attendance App.

## Overview

Facebook SSO will allow users to:
- Sign in with their Facebook account
- Automatically populate their name for RSVPs
- Maintain consistent identity across sessions
- Optionally share events to their Facebook timeline

## Prerequisites

1. **Facebook Developer Account**
   - Create a Facebook Developer account at https://developers.facebook.com/
   - Create a new Facebook App for the Event Attendance application

2. **App Configuration**
   - Configure the app domain and redirect URLs
   - Set up Facebook Login product
   - Configure permissions needed for the application

## Required Facebook Permissions

- `email` - To get the user's email address
- `public_profile` - To get basic profile information (name, profile picture)
- `user_events` - (Optional) To access user's Facebook events

## Implementation Steps

### 1. Environment Variables

Add the following to your `.env` file:

```env
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
FACEBOOK_REDIRECT_URI=http://localhost:3000/auth/facebook/callback
```

### 2. Install Facebook SDK Dependencies

```bash
npm install passport passport-facebook express-session
```

### 3. Frontend Integration

The Facebook JavaScript SDK is already prepared in the main app.js file. To activate it:

1. Update the `initializeFacebookSDK()` function with your App ID
2. Uncomment the Facebook login button in the HTML
3. Configure the login flow in the `facebookLogin()` function

### 4. Backend Authentication Routes

Add the following routes to your Express server:

```javascript
// Facebook OAuth routes
app.get('/auth/facebook', passport.authenticate('facebook', { 
    scope: ['email', 'public_profile'] 
}));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, redirect home
        res.redirect('/');
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});
```

### 5. User Data Integration

When a user signs in with Facebook:
- Store their Facebook ID and profile information
- Pre-populate the name field in RSVP forms
- Associate RSVPs with their Facebook identity
- Enable features like profile pictures in attendance lists

## Security Considerations

- Never expose your Facebook App Secret in client-side code
- Use HTTPS in production
- Validate and sanitize all user data received from Facebook
- Implement proper session management
- Consider rate limiting for authentication endpoints

## Current Status

- ✅ Placeholder structure created in HTML/CSS
- ✅ Basic JavaScript functions prepared
- ⏳ Environment configuration needed
- ⏳ Facebook App registration required
- ⏳ Backend authentication routes to be implemented
- ⏳ User data storage integration needed

## Testing

1. Test with Facebook's test users
2. Verify permission requests
3. Test login/logout flow
4. Validate data storage and retrieval
5. Test RSVP flow with authenticated users

## Production Deployment

1. Update redirect URIs to production domain
2. Switch to production Facebook App settings
3. Configure proper HTTPS certificates
4. Set up secure session storage
5. Monitor authentication logs

## Future Enhancements

- Share events to Facebook timeline
- Invite Facebook friends to events
- Import events from user's Facebook calendar
- Show Facebook profile pictures in attendance lists
- Enable Facebook event creation from the app

## Resources

- [Facebook Login for the Web](https://developers.facebook.com/docs/facebook-login/web)
- [Facebook JavaScript SDK](https://developers.facebook.com/docs/javascript)
- [Passport.js Facebook Strategy](http://www.passportjs.org/packages/passport-facebook/)