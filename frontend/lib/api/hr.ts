import { apiFetch } from "@/lib/api/client";
import type {
  Contract,
  Department,
  EmployeeProfile,
  Paginated,
  Payslip,
  UserBrief,
} from "@/lib/api/types";

export function listEmployees() {
  return apiFetch<Paginated<EmployeeProfile>>("/api/v1/hr/employees/");
}

export function getEmployee(id: string) {
  return apiFetch<EmployeeProfile>(`/api/v1/hr/employees/${id}/`);
}

export function createEmployee(data: { user_id: string; position: string; hire_date?: string }) {
  return apiFetch<EmployeeProfile>("/api/v1/hr/employees/", {
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

export function createDepartment(data: { name: string; color?: string }) {
  return apiFetch<Department>("/api/v1/departments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listUsers() {
  return apiFetch<Paginated<UserBrief>>("/api/v1/users/");
}
