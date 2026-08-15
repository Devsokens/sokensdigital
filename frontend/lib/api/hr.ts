import { apiFetch } from "@/lib/api/client";
import type {
  AuditLogEntry,
  Contract,
  Department,
  EmployeeProfile,
  Paginated,
  Payslip,
  Role,
  UserBrief,
} from "@/lib/api/types";

export function listEmployees() {
  return apiFetch<Paginated<EmployeeProfile>>("/api/v1/hr/employees/");
}

export function getEmployee(id: string) {
  return apiFetch<EmployeeProfile>(`/api/v1/hr/employees/${id}/`);
}

export function createEmployee(data: {
  user_id: string;
  position: string;
  hire_date?: string;
  gross_monthly_salary?: string;
}) {
  return apiFetch<EmployeeProfile>("/api/v1/hr/employees/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function provisionUser(data: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: string;
  department_id?: string;
}) {
  return apiFetch<UserBrief>("/api/v1/users/provision/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEmployee(id: string, data: Partial<{
  position: string;
  hire_date: string;
  gross_monthly_salary: string;
  status: string;
}>) {
  return apiFetch<EmployeeProfile>(`/api/v1/hr/employees/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function addContract(employeeId: string, data: Omit<Contract, "id" | "employee" | "created_at">) {
  return apiFetch<Contract>(`/api/v1/hr/employees/${employeeId}/contracts/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function addPayslip(employeeId: string, data: Omit<Payslip, "id" | "employee" | "created_at">) {
  return apiFetch<Payslip>(`/api/v1/hr/employees/${employeeId}/payslips/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listDepartments() {
  return apiFetch<Paginated<Department>>("/api/v1/departments/");
}

export function getDepartment(id: string) {
  return apiFetch<Department>(`/api/v1/departments/${id}/`);
}

export function createDepartment(data: { name: string; description?: string; color?: string }) {
  return apiFetch<Department>("/api/v1/departments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDepartment(id: string, data: Partial<{ name: string; description: string; color: string }>) {
  return apiFetch<Department>(`/api/v1/departments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function listUsers() {
  return apiFetch<Paginated<UserBrief>>("/api/v1/users/");
}

export function setUserRole(userId: string, data: { role: string; department_id?: string | null }) {
  return apiFetch<UserBrief>(`/api/v1/users/${userId}/role/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function listAuditLogs() {
  return apiFetch<Paginated<AuditLogEntry>>("/api/v1/audit-logs/");
}

export function listRoles() {
  return apiFetch<Paginated<Role>>("/api/v1/roles/");
}

export function updateRolePermissions(roleId: string, permissions: Record<string, string[]>) {
  return apiFetch<Role>(`/api/v1/roles/${roleId}/`, {
    method: "PATCH",
    body: JSON.stringify({ permissions }),
  });
}
