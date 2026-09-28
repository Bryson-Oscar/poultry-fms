# 🐔 Poultry-FMS (OvoCore Pro)

**An Enterprise-Grade Commercial Poultry Farm Management System.**

Poultry-FMS is a comprehensive, precision AgTech solution designed for modern commercial poultry operations. It bridges the gap between daily farm activities and executive financial visibility, providing real-time data on Feed Conversion Ratios (FCR), mortality analytics, inventory depletion, and flock health. 

Built with scalability in mind, it is engineered to handle everything from single-house broiler farms to multi-hub layer operations.

---

## ✨ Core Features

*   **📊 Precision Flock Tracking:** Monitor mortality rates, cull counts, and daily weight gain per batch or house. 
*   **🌾 Feed & Inventory Intelligence:** Track silo levels, predict depletion dates, and automatically calculate true FCR (Feed Conversion Ratio).
*   **🥚 Production Analytics:** For layer operations, track daily egg collection, grading (sizes/cracks), and laying percentages.
*   **🌡️ IoT Climate Ready:** Dashboard structure ready to integrate with environmental sensors (Temperature, Humidity, Ammonia levels).
*   **💰 Financial Reconciliation:** Track operational expenses (vaccines, feed, labor) against revenue to calculate precise profit margins per batch.
*   **🌙 Ag-Optimized UI/UX:** Features an "Eggshell & Earth" light mode and a low-glare dark mode specifically designed for early morning or late-night flock checks without eye strain.

---

## 🛠️ Tech Stack

*   **Frontend:** React / Next.js (App Router)
*   **Styling:** Tailwind CSS v4 (Custom semantic variables for AgTech)
*   **State Management:** Zustand / React Query
*   **Backend / API:** Node.js / Next.js API Routes
*   **Database:** PostgreSQL (via Prisma ORM or Supabase)
*   **Authentication:** NextAuth.js / Clerk

---

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed on your local machine:
*   Node.js (v18.0.0 or higher)
*   npm, yarn, or pnpm
*   PostgreSQL database (local or cloud-hosted)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/poultry-fms.git
   cd poultry-fms
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup:**
   Copy the example environment file and update the variables with your database credentials.
   ```bash
   cp .env.example .env.local
   ```

4. **Database Push / Migration:**
   ```bash
   npx prisma db push
   # or 
   npx prisma migrate dev
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```
   *Open [http://localhost:3000](http://localhost:3000) with your browser to see the dashboard.*

---

## 📁 Directory Structure

```text
poultry-fms/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable UI components (Cards, Charts, Modals)
│   ├── lib/              # Utility functions and Prisma client
│   ├── styles/           # Tailwind CSS configuration and semantic tokens
│   └── types/            # TypeScript interfaces (Flock, Feed, Health)
├── prisma/               # Database schema
├── public/               # Static assets
└── README.md
```

---

## 📈 Roadmap

- [x] Core batch and mortality tracking.
- [x] Semantic Tailwind UI implementation.
- [ ] Integration with SMS/WhatsApp for daily mortality/feed alerts.
- [ ] Mobile-responsive PWA (Progressive Web App) for offline data entry inside poultry houses.
- [ ] M-Pesa / Mobile money integration for automated retail egg sales.

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve the system, please:
1. Fork the repository.
2. Create a new feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Designed for operational reality. Stop guessing. Start knowing.*
