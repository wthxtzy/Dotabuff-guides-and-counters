#include <iostream>
#include <string>
#include <windows.h>

std::string toLowercase(const std::string& str) {
    std::string result;
    for (const char& c : str) {
        result += std::tolower(c);
    }
    return result;
}

std::string addDashIfTwoWords(const std::string& name) {
    std::string result;
    size_t spaceIndex = name.find(' ');
    if (spaceIndex != std::string::npos) {
        result = name.substr(0, spaceIndex) + "-" + name.substr(spaceIndex + 1);
    }
    else {
        result = name;
    }
    return result;
}

void displayMenu() {
    std::cout << "$$$ if the hero's name consists of two words, type it separated by a space plz $$$" << std::endl;
    std::cout << "" << std::endl;
    std::cout << "What do you want to know? (1 - current builds, 2 - counters): ";
}

void processChoice(int choice) {
    std::string hero;
    std::string url;

    switch (choice) {
    case 1:
        std::cout << "Enter hero name: ";
        std::cin.ignore();
        std::getline(std::cin, hero);
        hero = addDashIfTwoWords(hero);
        url = "https://www.dotabuff.com/heroes/" + toLowercase(hero) + "/guides";
        std::cout << "Link to current builds: " << url << std::endl;
        ShellExecuteA(NULL, "open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        // Code to open URL in browser
        break;
    case 2:
        std::cout << "Enter hero name: ";
        std::cin.ignore();
        std::getline(std::cin, hero);
        hero = addDashIfTwoWords(hero);
        url = "https://www.dotabuff.com/heroes/" + toLowercase(hero) + "/counters";
        std::cout << "Link to counters: " << url << std::endl;
        ShellExecuteA(NULL, "open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        // Code to open URL in browser
        break;
    default:
        std::cout << "Invalid choice." << std::endl;
        return;
    }

    std::cout << "--------------------------" << std::endl;
    displayMenu();

    int newChoice;
    std::cin >> newChoice;
    processChoice(newChoice);
}

int main() {
    displayMenu();

    int choice;
    std::cin >> choice;

    processChoice(choice);

    return 0;
}