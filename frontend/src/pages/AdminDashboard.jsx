import RequestDashboard from "../components/RequestDashboard.jsx";
import "./adminDashboard.scss";

export default function AdminDashboard() {
  return <div className="admin-dashboard"><RequestDashboard isAdmin /></div>;
}
