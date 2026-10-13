from django.urls import path

from . import caretaker_views, views

urlpatterns = [
    # family
    path('dashboard/', views.DashboardView.as_view()),
    path('alerts/<int:pk>/', views.AlertView.as_view()),
    path('chat/', views.ChatView.as_view()),
    # phones (caretaker and elderly)
    path('location/', caretaker_views.LocationView.as_view()),
    # caretaker
    path('shift/state/', caretaker_views.ShiftStateView.as_view()),
    path('shift/start/', caretaker_views.ShiftStartView.as_view()),
    path('shift/stop/', caretaker_views.ShiftStopView.as_view()),
    path('hours/', caretaker_views.HoursView.as_view()),
    path('tasks/', caretaker_views.TaskListView.as_view()),
    path('tasks/<int:pk>/', caretaker_views.TaskDetailView.as_view()),
]
