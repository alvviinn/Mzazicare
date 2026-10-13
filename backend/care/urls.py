from django.urls import path

from . import views

urlpatterns = [
    path('dashboard/', views.DashboardView.as_view()),
    path('alerts/<int:pk>/', views.AlertView.as_view()),
    path('chat/', views.ChatView.as_view()),
]
