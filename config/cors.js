const corsOptions = {
  origin:[
    "http://localhost:3000",
    "http://localhost:5173",
    "https://event-management-system-drab-psi.vercel.app",
    "https://webie-event-management-system.vercel.app",
    "https://event-app-ten-flax.vercel.app",
    "https://ems-webie.vercel.app",
    "http://webie.io.vn",
    "https://webie.io.vn",
    "http://ems.webie.com.vn",
    "https://ems.webie.com.vn",
    "http://localhost:8080" 
  ],
  methods:["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], // Bổ sung PATCH nếu API có dùng
  
  allowedHeaders:[
    "Content-Type", 
    "Authorization", 
    "Accept", 
    "Origin", 
    "X-Requested-With"
  ],
  
  credentials: true,
};

module.exports = corsOptions;