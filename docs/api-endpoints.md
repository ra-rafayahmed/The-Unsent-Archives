# Backend API Documentation

Base API URL is defined as `/api`. Unless specified as public, endpoints require a valid Authentication token.

## 1. Authentication
Endpoints for managing user access and sessions.
* **POST `/api/auth/register`** - Registers a new user account.
* **POST `/api/auth/login`** - Authenticates a user and returns a token.
* **GET `/api/auth/me`** - Retrieves the profile data of the currently logged-in user.
* **POST `/api/auth/logout`** - Logs the user out and invalidates the session.

## 2. Users & Profiles
Endpoints for managing user data and fetching their content.
* **GET `/api/users/:id`** - Get a specific user's public profile summary.
* **PUT `/api/users/:id`** - Update the current user's profile information.
* **GET `/api/users/:id/posts`** - Fetch the public (or owned) posts written by the user.
* **GET `/api/users/:id/collections`** - Fetch the public (or owned) collections created by the user.

## 3. Posts (Notes)
Endpoints for the core text-content creation system.
* **POST `/api/posts/`** - Create a new post/note.
* **GET `/api/posts/:id`** - Fetch a specific post/note.
* **PUT `/api/posts/:id`** - Update an existing post/note.
* **DELETE `/api/posts/:id`** - Delete a post/note.
* **POST `/api/posts/:id/repost`** - Share or repost an existing post to your own feed.
* **POST `/api/posts/:id/comments`** - Add a comment to a post.
* **DELETE `/api/posts/:id/comments/:commentId`** - Delete a specific comment.

## 4. Collections
Endpoints for the Pinterest-style "boards" where users group saved notes.
* **POST `/api/collections/`** - Create a new empty collection.
* **GET `/api/collections/:id`** - Fetch the contents and details of a collection.
* **PUT `/api/collections/:id`** - Update collection details (title, privacy).
* **DELETE `/api/collections/:id`** - Delete a collection.
* **POST `/api/collections/:id/posts`** - Add a specific post to the collection.
* **DELETE `/api/collections/:id/posts/:postId`** - Remove a specific post from the collection.

## 5. Feed System
Endpoints driving the main timeline/explore views.
* **GET `/api/feed/`** - Fetch the general explore feed.
* **GET `/api/feed/following`** - Fetch the feed constructed only from followed users.
* **GET `/api/feed/trending`** - Fetch the current trending or most popular public posts.

## 6. Tags & Search
Endpoints for discovering content.
* **GET `/api/search/`** - Global search for users, posts, and text snippets.
* **GET `/api/tags/`** - List all active/popular tags.
* **GET `/api/tags/trending`** - List the most trending hashtags right now.
* **GET `/api/tags/:slug/posts`** - Fetch all posts associated with a given tag.

## 7. Analytics
Endpoints for the private reporting dashboards for authors.
* **POST `/api/events`** - Log an interaction event (e.g., viewing a post) for metrics.
* **GET `/api/posts/:id/analytics`** - Get view/reach metrics for a specific post.
* **GET `/api/users/:id/analytics`** - Get aggregate interaction metrics for the user account wrapper.

## 8. Social Interaction (Follows & Reactions)
*(Note: These specific modules exist in the codebase but may be mapped uniquely under posts or users)*
* **POST `/follow`** - Follow a target user.
* **DELETE `/follow`** - Unfollow a target user.
* **GET `/followers`** - List users following an account.
* **GET `/following`** - List users an account is following.
* **POST `/reaction`** - Cast a like/favorite on a post.
* **DELETE `/reaction`** - Remove a like/favorite from a post.
* **GET `/reaction`** - Fetch the list of reactions for an entity.
