
class DevineNombre {
    static main(String) {
        // Générer un nombre aléatoire entre 0 et 100
        random = new Random();
        nombreADeviner = random.nextInt(101);

        // Étape 1 : Afficher le message
        System.out.println("Vous devez deviner un nombre entre 0 et 100");

        // Étape 2 : Lire la saisie de l’utilisateur et comparer avec le nombre à deviner
        scanner = new Scanner(System.in);
        proposition;
        do {
            System.out.print("Entrez votre proposition : ");
            proposition = scanner.nextInt();

            if (proposition < nombreADeviner) {
                System.out.println("C'est plus !");
            } else if (proposition > nombreADeviner) {
                System.out.println("C'est moins !");
            } else {
                System.out.println("Bravo, vous avez trouvé le nombre !");
            }
        } while (proposition != nombreADeviner);

        scanner.close();
    }
}

























