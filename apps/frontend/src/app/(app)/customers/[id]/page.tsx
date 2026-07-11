'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Alert, Button } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { CustomerApiForm } from '@/features/customers/components/customer-api-form';
import { buildCustomerPayload, customerToFormValues } from '@/lib/customer-form-utils';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer, CustomerFormValues } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';

export default function EditCustomerPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'customer-form-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: options = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'customer-form'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'customer_type,lead_source,industry' } })
        .then((response) => response.data),
  });

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`).then((response) => response.data),
  });

  const { data: projects = [] } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'by-customer', id],
    queryFn: () => api.get<ProjectItem[]>('/projects', { params: { customer_id: id } }).then((response) => response.data),
    enabled: Boolean(id),
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');

  const defaultValues = useMemo(
    () => (customer ? customerToFormValues(customer) : null),
    [customer],
  );

  const updateMutation = useMutation({
    mutationFn: (values: CustomerFormValues) => api.put(`/customers/${id}`, buildCustomerPayload(values)),
    onSuccess: (response) => {
      queryClient.setQueryData(['customers', id], response.data);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      notify.success('Cập nhật khách hàng thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật khách hàng thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (!customer || !defaultValues) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy khách hàng</Alert>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Chỉnh sửa khách hàng</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Khách hàng</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">{customer.customerCode}</span>
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Dự án ({projects.length})</h2>
            <p className="mt-1 text-sm text-slate-500">Các dự án đã triển khai cho khách hàng này.</p>
          </div>
          <Button
            component={Link}
            href={`/projects/new?customerId=${id}`}
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            Tạo dự án mới
          </Button>
        </div>
        {projects.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">Khách hàng này chưa có dự án nào.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-3 text-sm transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-950">{project.projectCode || project.projectName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{project.projectName}</p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                  {project.statusOption?.label || '-'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CustomerApiForm
        mode="edit"
        customer={customer}
        defaultValues={defaultValues}
        users={users}
        customerTypes={customerTypes}
        sources={sources}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
    </div>
  );
}
