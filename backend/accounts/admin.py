from django.contrib import admin

from .models import Invite, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'role', 'sponsor', 'date_joined')
    list_filter = ('role',)
    search_fields = ('email', 'name')
    exclude = ('password',)  # passwords are hashed; never shown or edited here


admin.site.register(Invite)
