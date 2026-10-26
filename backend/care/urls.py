from django.urls import path

from . import audio_views, caretaker_views, elder_views, shift_views, tone_live, views

urlpatterns = [
    # family
    path('dashboard/', views.DashboardView.as_view()),
    path('alerts/<int:pk>/', views.AlertView.as_view()),
    path('chat/', views.ChatView.as_view()),
    # shifts (one per day): caretaker and family
    path('shifts/', shift_views.ShiftListView.as_view()),
    path('shifts/<int:pk>/', shift_views.ShiftDetailView.as_view()),
    # phones (caretaker and elderly)
    path('location/', caretaker_views.LocationView.as_view()),
    # elderly
    path('elder/home/', elder_views.ElderHomeView.as_view()),
    path('elder/checkin/', elder_views.CheckInView.as_view()),
    path('elder/sos/', elder_views.SosView.as_view()),
    path('medicines/<int:pk>/take/', elder_views.MedicineTakeView.as_view()),
    # family manages medicine reminders
    path('medicines/', elder_views.MedicineListView.as_view()),
    path('medicines/<int:pk>/', elder_views.MedicineDetailView.as_view()),
    # caretaker
    path('shift/state/', caretaker_views.ShiftStateView.as_view()),
    path('shift/start/', caretaker_views.ShiftStartView.as_view()),
    path('shift/stop/', caretaker_views.ShiftStopView.as_view()),
    path('audio/tone/', audio_views.ToneView.as_view()),
    path('audio/status/', audio_views.StatusView.as_view()),
    path('audio/consent/', audio_views.ConsentView.as_view()),
    path('tone/live/', tone_live.LiveToneView.as_view()),
    path('hours/', caretaker_views.HoursView.as_view()),
    path('tasks/', caretaker_views.TaskListView.as_view()),
    path('tasks/<int:pk>/', caretaker_views.TaskDetailView.as_view()),
]
