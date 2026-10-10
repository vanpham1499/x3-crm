'use client';

import { useMemo, useState } from 'react';
import { ZaloRouteButton } from '@/features/zalo-crm/zalo-document-share';
import { useParams } from 'next/navigation';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CrmFlowBar } from '@/components/crm/crm-flow-bar';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { CustomerApiForm } from '@/features/customers/components/customer-api-form';
import { buildCustomerPayload, customerToFormValues } from '@/lib/customer-form-utils';
import { formatCustomerIdentity, formatDeletedCustomerRelations } from '@/lib/customer-utils';
import { getApiErrorMessage } from '@/lib/api-error';
import { canEditCustomer } from '@/lib/ownership';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { Customer, CustomerFormValues, DeletedCustomerCodeConflict } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export default function EditCustomerPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const [deletedCodeConflict, setDeletedCodeConflict] = useState<{
    customer: DeletedCustomerCodeConflict;
    values: CustomerFormValues;
  } | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'customer-form-options'],
    queryFn: () => api.get('/users/lookup?context=customer').then((response) => response.data),
  });

  const { data: options = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'customer-form'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'customer_type,lead_source' } })
        .then((response) => response.data),
  });

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customers', id],
    queryFn: () => api.get(`/customers/${id}`).then((response) => response.data),
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');

  const defaultValues = useMemo(
    () => (customer ? customerToFormValues(customer) : null),
    [customer],
  );

  const updateMutation = useMutation({
    mutationFn: ({
      values,
      purgeDeletedDuplicate = false,
    }: {
      values: CustomerFormValues;
      purgeDeletedDuplicate?: boolean;
    }) =>
      api.put(`/customers/${id}`, {
        ...buildCustomerPayload(values),
        purgeDeletedDuplicate,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(['customers', id], response.data);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      notify.success('Cập nhật khách hàng thành công');
      setDeletedCodeConflict(null);
    },
    onError: (error, variables) => {
      const responseData = (error as any)?.response?.data;
      const conflict = responseData?.deletedCustomer as DeletedCustomerCodeConflict | undefined;

      if (responseData?.code === 'deleted_customer_code_conflict' && conflict) {
        if (!conflict.canPurge) {
          const reason = conflict.blockers?.length
            ? ` vì đang có ${conflict.blockers.join(', ')}`
            : ' do bạn không có quyền xóa dữ liệu cũ';
          notify.error(
            `Mã này thuộc ${conflict.displayName} đã xóa và không thể xóa hẳn${reason}.`,
          );
          return;
        }

        setDeletedCodeConflict({ customer: conflict, values: variables.values });
        return;
      }

      notify.error(getApiErrorMessage(error, 'Cập nhật khách hàng thất bại'));
    },
  });

  const deletedAtLabel = useMemo(() => {
    const value = deletedCodeConflict?.customer.deletedAt;
    if (!value) return 'không rõ thời gian';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(parsed);
  }, [deletedCodeConflict?.customer.deletedAt]);
  const deletedRelationsLabel = formatDeletedCustomerRelations(deletedCodeConflict?.customer);

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
    <>
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
        <PageHeader
          title={formatCustomerIdentity(customer, 'Khách hàng')}
          currentLabel="Hồ sơ"
          eyebrow={
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              Customer
            </span>
          }
        />

        <CrmFlowBar
          steps={[
            {
              label: 'Lead',
              state: customer.leadId ? 'done' : 'pending',
              href: customer.leadId ? `/leads/${customer.leadId}` : undefined,
            },
            { label: 'Customer', state: 'active', href: `/customers/${customer.id}` },
          ]}
        />

        <div className="my-4"><ZaloRouteButton kind="customer" id={customer.id} /></div>
        <CustomerApiForm
          mode="edit"
          customer={customer}
          defaultValues={defaultValues}
          users={users}
          customerTypes={customerTypes}
          sources={sources}
          isSubmitting={updateMutation.isPending}
          readOnly={!canEditCustomer(currentUser, customer)}
          onSubmit={(values) => updateMutation.mutateAsync({ values })}
        />
      </div>

      <ConfirmDialog
        open={Boolean(deletedCodeConflict)}
        title={
          deletedCodeConflict?.customer.blockers?.length
            ? 'Xóa toàn bộ dữ liệu khách hàng cũ?'
            : 'Mã khách hàng đã từng tồn tại'
        }
        description={
          deletedCodeConflict?.customer.blockers?.length
            ? `Mã ${deletedCodeConflict.customer.customerCode} thuộc “${deletedCodeConflict.customer.displayName}”, đã xóa lúc ${deletedAtLabel}. Hồ sơ cũ đang có ${deletedCodeConflict.customer.blockers.join(', ')}.${deletedRelationsLabel ? ` ${deletedRelationsLabel}.` : ''} Nếu tiếp tục, toàn bộ hồ sơ và dữ liệu liên quan này sẽ bị xóa vĩnh viễn trước khi cập nhật khách hàng hiện tại.`
            : `Mã ${deletedCodeConflict?.customer.customerCode || ''} là dữ liệu của “${deletedCodeConflict?.customer.displayName || 'khách hàng cũ'}”, đã xóa lúc ${deletedAtLabel}. Bạn có muốn xóa vĩnh viễn dữ liệu cũ và cập nhật khách hàng hiện tại không?`
        }
        confirmText={
          deletedCodeConflict?.customer.blockers?.length
            ? 'Xóa toàn bộ & cập nhật'
            : 'Xóa hẳn & cập nhật'
        }
        cancelText="Không xóa"
        loading={updateMutation.isPending}
        onClose={() => setDeletedCodeConflict(null)}
        onConfirm={() => {
          if (!deletedCodeConflict) return;
          updateMutation.mutate({
            values: deletedCodeConflict.values,
            purgeDeletedDuplicate: true,
          });
        }}
      />
    </>
  );
}
