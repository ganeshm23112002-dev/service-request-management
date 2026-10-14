import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../services/api.js";
import "./employeeManagement.scss";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/admin/employees/", { params });
      setEmployees(data.results);
      setCount(data.count);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return (
    <section className="employee-management" aria-labelledby="employee-management-title">
      <div className="employee-management__heading">
        <div>
          <h2 id="employee-management-title">Employees</h2>
          <p>View employee accounts. Roles and account access are managed separately.</p>
        </div>
        <label className="employee-management__search">
          <span className="sr-only">Search employees by username or email</span>
          <input
            type="search"
            value={search}
            maxLength={100}
            placeholder="Search username or email"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <div className="employee-management__panel">
        {loading ? (
          <div className="employee-management__state" role="status">
            <span className="loading-screen__spinner" /> Loading employees…
          </div>
        ) : error ? (
          <div className="employee-management__state employee-management__state--error" role="alert">
            <strong>Unable to load employees.</strong>
            <span>{error}</span>
            <button type="button" onClick={loadEmployees}>Try again</button>
          </div>
        ) : employees.length === 0 ? (
          <div className="employee-management__state">No employee accounts found.</div>
        ) : (
          <>
            <div className="employee-management__table-wrap">
              <table className="employee-management__table">
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Date joined</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td data-label="Username">{employee.username}</td>
                      <td data-label="Email">{employee.email || "—"}</td>
                      <td data-label="Role">{employee.role}</td>
                      <td data-label="Date joined">{formatDate(employee.date_joined)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="employee-management__pagination" aria-label="Employee list pagination">
              <span>Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, count)} of {count}</span>
              <div>
                <button type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>Previous</button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= pageCount}>Next</button>
              </div>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
