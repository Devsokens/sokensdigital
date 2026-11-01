from rest_framework.pagination import PageNumberPagination


class SelectorPagination(PageNumberPagination):
    """25 par page comme partout (REST_FRAMEWORK['PAGE_SIZE']), mais
    `?page_size=` permet aux écrans qui affichent tout d'un bloc (tunnel
    commercial, listes de choix d'un client ou d'un contact) de tout charger
    en une requête."""
    page_size_query_param = 'page_size'
    max_page_size = 500
