# GenZ Restaurant POS - Backend

Backend API for the GenZ Restaurant POS system.

## Stack

- Node.js + Express.js
- MongoDB (Mongoose)
- Socket.IO for real-time order updates
- JWT authentication (bcryptjs)
- Cloudinary for image uploads
- Multer for file handling

## Scripts

```bash
npm run dev            # Start with nodemon
npm start              # Start production
npm run populate-menu  # Seed menu from catalog
```

## API Overview

- Authentication (/auth)
- Menu management (/menu)
- Orders (/orders) with Socket.IO real-time updates
- Admin dashboard endpoints
- Image upload to Cloudinary

## Environment Variables

```
MONGO_URI / MONGO_URI_DIRECT
JWT_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
PORT (default: 5000)
```
