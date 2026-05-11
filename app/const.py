from enum import Enum


class MemberType(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"

class ChatType(str, Enum):
    DM = "DM"
    GROUP = "GROUP"