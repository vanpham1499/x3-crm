<?php

namespace App\Http\Controllers;

use App\Services\ZaloTeamWorkspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ZaloTeamWorkspaceController extends Controller
{
    public function command(Request $request, ZaloTeamWorkspace $service)
    {
        abort_unless(Schema::hasTable('zt_crm_workspaces'), 503, 'Chức năng cộng tác CRM chưa được cập nhật trên máy chủ.');
        abort_unless(Schema::hasTable('zt_crm_tasks'), 503, 'Cần cập nhật dữ liệu công việc CRM trên máy chủ.');
        $v = $request->validate([
            'kind' => 'required|in:read,summaries,lookup,claim,assign,state,link,unlink,note,notes,task_create,task_edit,task_status,presence,board',
            'accountId' => 'required_unless:kind,summaries,board|integer|min:1',
            'conversationId' => ['required_unless:kind,summaries,lookup,board', 'string', 'regex:/^g?[0-9]{1,30}$/D'],
            'revision' => 'required_if:kind,claim,assign,state,link,unlink,note,task_create,task_edit,task_status|integer|min:0',
            'assigneeId' => 'present_if:kind,assign|nullable|integer|min:1',
            'state' => 'required_if:kind,state|in:needs_action,in_progress,waiting_customer,resolved',
            'entityKind' => 'required_if:kind,lookup,link,unlink|in:lead,customer,project',
            'entityId' => 'required_if:kind,link,unlink|integer|min:1',
            'customerId' => 'sometimes|nullable|integer|min:1',
            'search' => 'sometimes|nullable|string|max:120', 'page' => 'sometimes|integer|min:0|max:10000',
            'body' => 'required_if:kind,note|string|max:4000',
            'mentions' => 'sometimes|array|max:10', 'mentions.*' => 'integer|min:1|distinct',
            'before' => 'sometimes|integer|min:0',
            'taskId' => 'prohibited_if:kind,task_create|required_if:kind,task_edit,task_status|integer|min:1',
            'taskRevision' => 'required_if:kind,task_edit,task_status|integer|min:0',
            'taskAssigneeId' => 'required_if:kind,task_create,task_edit|integer|min:1',
            'title' => 'required_if:kind,task_create,task_edit|string|max:240',
            'description' => 'sometimes|nullable|string|max:4000',
            'dueAt' => 'required_if:kind,task_create,task_edit|date',
            'taskStatus' => 'required_if:kind,task_status|in:todo,doing,done,cancelled',
            'repeat' => 'sometimes|in:none,weekly,renewal',
            'projectId' => 'sometimes|nullable|integer|min:1',
            'sourceMessageId' => ['sometimes', 'nullable', 'string', 'max:128', 'regex:/^[A-Za-z0-9_:\-]+$/D'],
            'sourceTime' => 'sometimes|nullable|integer|min:1|max:9999999999999',
            'sessionId' => ['required_if:kind,presence', 'string', 'regex:/^[A-Za-z0-9-]{16,64}$/D'],
            'presenceState' => 'required_if:kind,presence|in:viewing,typing,leave',
            'scope' => 'sometimes|in:mine,team', 'view' => 'sometimes|in:tasks,conversations',
            'taskFilter' => 'sometimes|in:open,overdue,done,all',
            'workState' => 'sometimes|nullable|in:needs_action,in_progress,waiting_customer,resolved',
            'personId' => 'sometimes|nullable|integer|min:1',
            'unassigned' => 'sometimes|boolean',
        ]);
        foreach (['accountId', 'revision', 'assigneeId', 'entityId', 'customerId', 'page'] as $key) {
            if (isset($v[$key])) {
                $v[$key] = (int) $v[$key];
            }
        }
        $u = $request->user();
        $result = match ($v['kind']) {
            'summaries' => $service->summaries($u),
            'board' => $service->board($u, $v),
            'presence' => $service->presence($u, $v),
            'notes' => $service->notes($u, $v['accountId'], $v['conversationId'], $v['before'] ?? 0),
            'read' => $service->read($u, $v['accountId'], $v['conversationId'], $v['taskId'] ?? null),
            'lookup' => $service->lookup($u, $v['accountId'], $v['entityKind'], $v['search'] ?? '', $v['page'] ?? 0, $v['customerId'] ?? null),
            default => $service->mutate($u, $v),
        };

        return response()->json($result)->header('Cache-Control', 'private, no-store');
    }
}
